'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import {
  BookOpen,
  Upload,
  Trash2,
  Search,
  FileText,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { supabaseAdmin, type KnowledgeBase } from '@/lib/supabase'
import Header from '@/components/layout/Header'

const API_URL = '/api/backend'

type SearchResult = {
  id: string
  title: string
  content: string
  similarity: number
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [expandedSource, setExpandedSource] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .select('id, title, source, is_active, created_at, content')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data ?? [])
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Group docs by source
  const grouped = documents.reduce<Record<string, KnowledgeBase[]>>((acc, doc) => {
    const src = doc.source ?? 'Unknown'
    if (!acc[src]) acc[src] = []
    acc[src].push(doc)
    return acc
  }, {})

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/api/knowledge/ingest`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setUploadSuccess(`Successfully ingested: ${file.name}`)
      fetchDocuments()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    e.target.value = ''
  }

  const handleDelete = async (source: string) => {
    setActionLoading('delete-' + source)
    try {
      const res = await fetch(`${API_URL}/api/knowledge/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      if (!res.ok) throw new Error()
      setDocuments((prev) => prev.filter((d) => d.source !== source))
    } catch {
      // Fallback: delete from Supabase directly
      await supabaseAdmin.from('knowledge_base').delete().eq('source', source)
      fetchDocuments()
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggle = async (source: string, currentActive: boolean) => {
    setActionLoading('toggle-' + source)
    try {
      const res = await fetch(`${API_URL}/api/knowledge/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, is_active: !currentActive }),
      })
      if (!res.ok) throw new Error()
      setDocuments((prev) =>
        prev.map((d) => (d.source === source ? { ...d, is_active: !currentActive } : d))
      )
    } catch {
      await supabaseAdmin
        .from('knowledge_base')
        .update({ is_active: !currentActive })
        .eq('source', source)
      fetchDocuments()
    } finally {
      setActionLoading(null)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const res = await fetch(`${API_URL}/api/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSearchResults(data.results ?? data ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDocuments()
  }

  const totalChunks = documents.length
  const activeSources = Object.keys(grouped).filter((src) =>
    grouped[src].some((d) => d.is_active)
  ).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header onRefresh={handleRefresh} refreshing={refreshing} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Documents</p>
            <p className="text-2xl font-bold text-white">{Object.keys(grouped).length}</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Chunks</p>
            <p className="text-2xl font-bold text-white">{totalChunks}</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Active Sources</p>
            <p className="text-2xl font-bold text-green-400">{activeSources}</p>
          </div>
        </div>

        {/* Upload area */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Upload Document</h3>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-dark-500 hover:border-dark-400 hover:bg-dark-700/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.pdf,.md,.docx,.json,.csv"
              onChange={handleFileInput}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-indigo-400">Uploading & processing...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-500" />
                <p className="text-sm text-gray-400">
                  Drop a file here or <span className="text-indigo-400">browse</span>
                </p>
                <p className="text-xs text-gray-600">Supports: .txt, .pdf, .md, .docx, .json, .csv</p>
              </div>
            )}
          </div>
          {uploadError && (
            <div className="flex items-center gap-2 mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{uploadError}</p>
              <button onClick={() => setUploadError('')} className="ml-auto">
                <X className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          )}
          {uploadSuccess && (
            <div className="flex items-center gap-2 mt-3 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-xs text-green-400">{uploadSuccess}</p>
              <button onClick={() => setUploadSuccess('')} className="ml-auto">
                <X className="w-3.5 h-3.5 text-green-400" />
              </button>
            </div>
          )}
        </div>

        {/* Semantic search */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Semantic Search</h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((r, i) => (
                <div key={r.id ?? i} className="bg-dark-700 border border-dark-600 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white">{r.title}</p>
                    {r.similarity != null && (
                      <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">
                        {(r.similarity * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-3">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white">Documents</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <BookOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No documents yet</p>
              <p className="text-xs mt-1">Upload a file to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-600">
              {Object.entries(grouped).map(([source, docs]) => {
                const isActive = docs.some((d) => d.is_active)
                const isExpanded = expandedSource === source

                return (
                  <div key={source}>
                    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-dark-700/30 transition-colors">
                      <button
                        onClick={() => setExpandedSource(isExpanded ? null : source)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-dark-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{source}</p>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                isActive
                                  ? 'bg-green-500/15 text-green-400 border-green-500/20'
                                  : 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                              }`}
                            >
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {docs.length} chunk{docs.length !== 1 ? 's' : ''} &middot;{' '}
                            {format(parseISO(docs[0].created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                        )}
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggle(source, isActive)}
                          disabled={actionLoading === 'toggle-' + source}
                          className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                          title={isActive ? 'Deactivate' : 'Activate'}
                        >
                          {actionLoading === 'toggle-' + source ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : isActive ? (
                            <ToggleRight className="w-5 h-5 text-green-400" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-500" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(source)}
                          disabled={actionLoading === 'delete-' + source}
                          className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {actionLoading === 'delete-' + source ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded chunks */}
                    {isExpanded && (
                      <div className="border-t border-dark-600 bg-dark-900/50">
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="px-5 py-3 border-b border-dark-600/50 last:border-b-0"
                          >
                            <p className="text-xs font-medium text-gray-300 mb-1">{doc.title}</p>
                            <p className="text-xs text-gray-500 line-clamp-2">{doc.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

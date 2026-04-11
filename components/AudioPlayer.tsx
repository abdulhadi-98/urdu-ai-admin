'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { hashString } from '@/lib/utils'

interface AudioPlayerProps {
  src?: string | null
  text?: string | null
  transcription?: string | null
  className?: string
}

function generateWaveformBars(seed: string, count: number = 32): number[] {
  const hash = hashString(seed || 'default')
  const bars: number[] = []
  let current = hash
  for (let i = 0; i < count; i++) {
    current = (current * 1103515245 + 12345) & 0x7fffffff
    bars.push(20 + (current % 60))
  }
  return bars
}

export default function AudioPlayer({ src, text, transcription, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [synthPlaying, setSynthPlaying] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const seed = text || src || 'audio'
  const bars = generateWaveformBars(seed)

  // Audio element handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => { setPlaying(false); setProgress(0) }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  const toggleAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => {})
      setPlaying(true)
    }
  }, [playing])

  const toggleSynth = useCallback(() => {
    if (!text) return
    if (synthPlaying) {
      window.speechSynthesis.cancel()
      setSynthPlaying(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ur-PK'
    utterance.rate = 0.9
    utterance.onend = () => setSynthPlaying(false)
    utterance.onerror = () => setSynthPlaying(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setSynthPlaying(true)
  }, [text, synthPlaying])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    audio.currentTime = ratio * audio.duration
    setProgress(ratio * 100)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const isPlayingState = src ? playing : synthPlaying
  const toggleFn = src ? toggleAudio : toggleSynth

  return (
    <div className={`bg-dark-700 border border-dark-500 rounded-xl p-3 ${className ?? ''}`}>
      {src && (
        <audio ref={audioRef} src={src} muted={muted} preload="metadata" />
      )}

      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={toggleFn}
          className="w-9 h-9 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center shrink-0 transition-colors"
        >
          {isPlayingState ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </button>

        {/* Waveform */}
        <div
          className="flex-1 flex items-center gap-0.5 h-10 cursor-pointer"
          onClick={src ? handleSeek : undefined}
        >
          {bars.map((height, i) => {
            const filled = src ? (i / bars.length) * 100 < progress : isPlayingState && i < bars.length * 0.4
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors ${
                  filled ? 'bg-indigo-400' : 'bg-dark-400'
                }`}
                style={{ height: `${height}%` }}
              />
            )
          })}
        </div>

        {/* Time / Mute */}
        <div className="flex items-center gap-2 shrink-0">
          {src && duration > 0 && (
            <span className="text-xs text-gray-500 font-mono">
              {formatTime(audioRef.current?.currentTime ?? 0)}/{formatTime(duration)}
            </span>
          )}
          {src && (
            <button
              onClick={() => setMuted(!muted)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          {!src && (
            <span className="text-xs text-gray-500">TTS</span>
          )}
        </div>
      </div>

      {/* Transcription */}
      {transcription && (
        <p className="text-xs text-gray-400 italic mt-2 pl-12">{transcription}</p>
      )}
    </div>
  )
}

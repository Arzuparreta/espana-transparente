"use client"

interface ShareButtonProps {
  text: string
  url: string
}

export function ShareButton({ text, url }: ShareButtonProps) {
  function handleShare() {
    const fullText = `${text}\n${url}`
    if (navigator.share) {
      navigator.share({ text: fullText, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(fullText).then(() => {
        const btn = document.getElementById("share-btn-label")
        if (btn) {
          const original = btn.textContent
          btn.textContent = "Copiado"
          setTimeout(() => { if (btn) btn.textContent = original }, 1800)
        }
      })
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2 rounded-[2px] border border-border/70 bg-card/60 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <span id="share-btn-label">Compartir dato</span>
    </button>
  )
}

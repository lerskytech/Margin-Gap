// Simple toast notification utility

let toastContainer: HTMLDivElement | null = null

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

export function showToast(message: string, duration: number = 3000) {
  ensureToastContainer()
  const toast = document.createElement('div')
  toast.className = 'bg-surface border border-subtle rounded-lg px-4 py-3 shadow-lg text-sm text-foreground animate-in slide-in-from-top-2'
  toast.textContent = message
  
  const container = ensureToastContainer()
  container.appendChild(toast)
  
  setTimeout(() => {
    toast.classList.add('animate-out', 'fade-out')
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    }, 200)
  }, duration)
}


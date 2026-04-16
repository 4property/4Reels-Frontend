import './style.css'

const app = document.querySelector('#app')

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'music', label: 'Music' },
  { id: 'reel', label: 'Reel' },
  { id: 'poster', label: 'Poster' },
  { id: 'voiceover', label: 'Voiceover' },
  { id: 'social', label: 'Social' },
  { id: 'summary', label: 'Summary' },
]

const networks = ['instagram', 'facebook', 'tiktok', 'youtube']

let nextId = 100
let dragSlideId = null
let mediaRecorder = null
let recordingStream = null
let recordedChunks = []
let recordingTimer = null

const state = {
  activeTab: 'dashboard',
  publishMode: 'manual',
  selectedJobId: 'job-1',
  selectedSlideId: 'slide-1',
  selectedTrackId: 'track-1',
  selectedNetwork: 'instagram',
  captionsEnabled: true,
  reelDefaults: true,
  reelEndPosition: 'end',
  randomMusic: true,
  defaultTrackId: 'track-1',
  posterStatus: 'Sale Agreed',
  posterText: 'Sale Agreed',
  posterVideoEnabled: false,
  voiceNotes: 'Short, calm and clear.',
  socialTemplates: {
    instagram: 'New property now live at {address}. Message us to book a viewing.',
    facebook: 'Fresh to market in {area}. Request the brochure for full details.',
    tiktok: 'New listing alert. Comment TOUR for the details.',
    youtube: 'Full property walkthrough for {address}. Contact us to arrange a viewing.',
  },
  recordingSupported:
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices && window.MediaRecorder),
  recordingState: 'idle',
  recordingSeconds: 0,
  recordingUrl: '',
  jobs: [
    { id: 'job-1', title: 'Seaview Lane Reel', type: 'Reel', status: 'Needs approval' },
    { id: 'job-2', title: 'Harbour Road Poster', type: 'Poster', status: 'Needs approval' },
    { id: 'job-3', title: 'Willow Court Reel', type: 'Reel', status: 'Draft' },
    { id: 'job-4', title: 'Oakview Terrace Poster', type: 'Poster', status: 'Published' },
  ],
  slides: [
    {
      id: 'slide-1',
      name: 'Front shot',
      type: 'video',
      caption: 'Start with the front of the property.',
      previewUrl: '',
      tone: 'sky',
    },
    {
      id: 'slide-2',
      name: 'Kitchen',
      type: 'image',
      caption: 'Show the kitchen and the light.',
      previewUrl: '',
      tone: 'sand',
    },
    {
      id: 'slide-3',
      name: 'Garden',
      type: 'video',
      caption: 'Close with the garden and the call to action.',
      previewUrl: '',
      tone: 'green',
    },
  ],
  tracks: [
    { id: 'track-1', name: 'Morning Keys', liked: true, uploaded: true },
    { id: 'track-2', name: 'Open House', liked: true, uploaded: true },
    { id: 'track-3', name: 'Clean Horizon', liked: false, uploaded: false },
  ],
}

function createId(prefix) {
  nextId += 1
  return `${prefix}-${nextId}`
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[char]
  })
}

function getJob() {
  return state.jobs.find((job) => job.id === state.selectedJobId) || state.jobs[0]
}

function getSlide() {
  return state.slides.find((slide) => slide.id === state.selectedSlideId) || state.slides[0]
}

function getTrack() {
  return state.tracks.find((track) => track.id === state.selectedTrackId) || state.tracks[0]
}

function syncState() {
  if (!state.jobs.some((job) => job.id === state.selectedJobId)) {
    state.selectedJobId = state.jobs[0]?.id || ''
  }

  if (!state.slides.some((slide) => slide.id === state.selectedSlideId)) {
    state.selectedSlideId = state.slides[0]?.id || ''
  }

  if (!state.tracks.some((track) => track.id === state.selectedTrackId)) {
    state.selectedTrackId = state.tracks[0]?.id || ''
  }

  if (!state.tracks.some((track) => track.id === state.defaultTrackId)) {
    state.defaultTrackId = state.tracks[0]?.id || ''
  }
}

function renderBadge(status) {
  const tone =
    status === 'Published' ? 'success' : status === 'Needs approval' ? 'warning' : 'neutral'
  return `<span class="badge badge-${tone}">${escapeHtml(status)}</span>`
}

function renderVisual(item, variant = 'card') {
  if (item.previewUrl) {
    if (item.type === 'video') {
      return `<div class="uploaded uploaded-${variant}"><video src="${escapeHtml(item.previewUrl)}" muted loop playsinline></video></div>`
    }
    return `<div class="uploaded uploaded-${variant}"><img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.name)}" /></div>`
  }

  return `
    <div class="visual tone-${escapeHtml(item.tone || 'sky')} visual-${variant}">
      <div class="visual-sky"></div>
      <div class="visual-ground"></div>
      <div class="visual-house">
        <span class="roof"></span>
        <span class="body"></span>
        <span class="door"></span>
      </div>
    </div>
  `
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <strong>PropertyFlow</strong>
          <span>Content setup</span>
        </div>
      </div>

      <nav class="nav">
        ${tabs
          .map(
            (tab) => `
              <button
                class="nav-item${state.activeTab === tab.id ? ' is-active' : ''}"
                type="button"
                data-action="switch-tab"
                data-tab-id="${tab.id}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `,
          )
          .join('')}
      </nav>
    </aside>
  `
}

function renderHeader() {
  return `
    <header class="header">
      <div>
        <p class="eyebrow">Estate agent setup</p>
        <h1>Reels and posters</h1>
      </div>

      <div class="header-actions">
        <button
          class="chip${state.publishMode === 'manual' ? ' is-active' : ''}"
          type="button"
          data-action="set-mode"
          data-mode="manual"
        >
          Manual approval
        </button>
        <button
          class="chip${state.publishMode === 'auto' ? ' is-active' : ''}"
          type="button"
          data-action="set-mode"
          data-mode="auto"
        >
          Auto publish
        </button>
      </div>
    </header>
  `
}

function renderDashboard() {
  return `
    <section class="card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Dashboard</p>
          <h2>Items to review</h2>
        </div>
      </div>

      <div class="job-list">
        ${state.jobs
          .map(
            (job) => `
              <button
                class="job-row${state.selectedJobId === job.id ? ' is-selected' : ''}"
                type="button"
                data-action="select-job"
                data-job-id="${job.id}"
              >
                <div>
                  <strong>${escapeHtml(job.title)}</strong>
                  <span>${escapeHtml(job.type)}</span>
                </div>
                ${renderBadge(job.status)}
              </button>
            `,
          )
          .join('')}
      </div>

      ${
        getJob().status !== 'Published'
          ? `<button class="primary-button full" type="button" data-action="approve-job" data-job-id="${getJob().id}">Approve selected item</button>`
          : ''
      }
    </section>
  `
}

function renderMusic() {
  return `
    <section class="grid two">
      <div class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">Music</p>
            <h2>Playlist</h2>
          </div>
          <button class="chip${state.randomMusic ? ' is-active' : ''}" type="button" data-action="toggle-random">
            Random liked songs
          </button>
        </div>

        <label class="dropzone" data-dropzone="music">
          <span>Add music</span>
          <input class="sr-only" type="file" accept="audio/*" multiple data-upload="music" />
        </label>

        <div class="simple-list">
          ${state.tracks
            .map(
              (track) => `
                <div class="simple-row${state.selectedTrackId === track.id ? ' is-selected' : ''}">
                  <button class="row-main" type="button" data-action="select-track" data-track-id="${track.id}">
                    <strong>${escapeHtml(track.name)}</strong>
                  </button>
                  <div class="row-actions">
                    <button class="mini${track.liked ? ' is-active' : ''}" type="button" data-action="toggle-like" data-track-id="${track.id}">Like</button>
                    <button class="mini${state.defaultTrackId === track.id ? ' is-active' : ''}" type="button" data-action="set-default-track" data-track-id="${track.id}">Default</button>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>

      <div class="card">
        <p class="eyebrow">Selected track</p>
        <h2>${escapeHtml(getTrack().name)}</h2>
      </div>
    </section>
  `
}

function renderReel() {
  const slide = getSlide()

  return `
    <section class="grid two">
      <div class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">Reel</p>
            <h2>Slides</h2>
          </div>
          <button class="chip${state.reelDefaults ? ' is-active' : ''}" type="button" data-action="toggle-reel-defaults">
            Save as default
          </button>
        </div>

        <label class="dropzone" data-dropzone="slides">
          <span>Add photo or video</span>
          <input class="sr-only" type="file" accept="image/*,video/*" multiple data-upload="slides" />
        </label>

        <div class="chip-group">
          ${['start', 'middle', 'end']
            .map(
              (position) => `
                <button class="chip${state.reelEndPosition === position ? ' is-active' : ''}" type="button" data-action="set-end-position" data-position="${position}">
                  ${escapeHtml(position)}
                </button>
              `,
            )
            .join('')}
        </div>

        <div class="simple-list">
          ${state.slides
            .map(
              (item, index) => `
                <div
                  class="slide-row${state.selectedSlideId === item.id ? ' is-selected' : ''}"
                  draggable="true"
                  data-slide-row
                  data-slide-id="${item.id}"
                >
                  <button class="slide-main" type="button" data-action="select-slide" data-slide-id="${item.id}">
                    <span class="drag-handle"></span>
                    <div class="thumb">${renderVisual(item, 'thumb')}</div>
                    <strong>${escapeHtml(item.name)}</strong>
                  </button>
                  <div class="row-actions">
                    <button class="mini" type="button" data-action="move-slide-up" data-slide-id="${item.id}" ${index === 0 ? 'disabled' : ''}>Up</button>
                    <button class="mini" type="button" data-action="move-slide-down" data-slide-id="${item.id}" ${index === state.slides.length - 1 ? 'disabled' : ''}>Down</button>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">Preview</p>
            <h2>${escapeHtml(slide.name)}</h2>
          </div>
          <button class="chip${state.captionsEnabled ? ' is-active' : ''}" type="button" data-action="toggle-captions">
            Captions
          </button>
        </div>

        <div class="preview">
          ${renderVisual(slide, 'preview')}
          ${
            state.captionsEnabled
              ? `<div class="overlay">${escapeHtml(slide.caption)}</div>`
              : ''
          }
        </div>

        <div class="field">
          <label class="eyebrow" for="slide-caption">Caption</label>
          <textarea id="slide-caption" rows="4" data-input="slide-caption">${escapeHtml(slide.caption)}</textarea>
        </div>
      </div>
    </section>
  `
}

function renderPoster() {
  return `
    <section class="grid two">
      <div class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">Poster</p>
            <h2>Status</h2>
          </div>
        </div>

        <div class="chip-group">
          ${['Sold', 'Agreed', 'Sale Agreed']
            .map(
              (status) => `
                <button class="chip${state.posterStatus === status ? ' is-active' : ''}" type="button" data-action="set-poster-status" data-status="${status}">
                  ${escapeHtml(status)}
                </button>
              `,
            )
            .join('')}
        </div>

        <div class="field">
          <label class="eyebrow" for="poster-text">Banner text</label>
          <input id="poster-text" type="text" value="${escapeHtml(state.posterText)}" data-input="poster-text" />
        </div>

        <button class="chip${state.posterVideoEnabled ? ' is-active' : ''}" type="button" data-action="toggle-poster-video">
          End video
        </button>

        <label class="dropzone" data-dropzone="poster-video">
          <span>Add poster end video</span>
          <input class="sr-only" type="file" accept="video/*" data-upload="poster-video" />
        </label>
      </div>

      <div class="card">
        <p class="eyebrow">Preview</p>
        <div class="poster-preview">
          ${renderVisual({ type: 'image', tone: 'blue', name: 'Poster' }, 'poster')}
          <div class="poster-tag">${escapeHtml(state.posterText)}</div>
        </div>
      </div>
    </section>
  `
}

function renderVoiceover() {
  const label =
    state.recordingState === 'recording'
      ? `Recording ${formatTime(state.recordingSeconds)}`
      : state.recordingState === 'ready'
        ? 'Recording ready'
        : state.recordingState === 'blocked'
          ? 'Microphone blocked'
          : 'Ready to record'

  return `
    <section class="grid two">
      <div class="card">
        <p class="eyebrow">Preview</p>
        <div class="preview">
          ${renderVisual(getSlide(), 'preview')}
          <div class="overlay">Record while you watch the preview.</div>
        </div>
      </div>

      <div class="card">
        <p class="eyebrow">Voiceover</p>
        <h2>${escapeHtml(label)}</h2>

        <div class="row-actions top-space">
          <button class="primary-button" type="button" data-action="start-recording" ${state.recordingState === 'recording' || !state.recordingSupported ? 'disabled' : ''}>Start</button>
          <button class="secondary-button" type="button" data-action="stop-recording" ${state.recordingState !== 'recording' ? 'disabled' : ''}>Stop</button>
          <button class="secondary-button" type="button" data-action="clear-recording" ${!state.recordingUrl ? 'disabled' : ''}>Clear</button>
        </div>

        ${state.recordingUrl ? `<audio class="audio" controls src="${escapeHtml(state.recordingUrl)}"></audio>` : ''}

        <div class="field">
          <label class="eyebrow" for="voice-notes">Notes</label>
          <textarea id="voice-notes" rows="4" data-input="voice-notes">${escapeHtml(state.voiceNotes)}</textarea>
        </div>
      </div>
    </section>
  `
}

function renderSocial() {
  return `
    <section class="grid two">
      <div class="card">
        <div class="chip-group">
          ${networks
            .map(
              (network) => `
                <button class="chip${state.selectedNetwork === network ? ' is-active' : ''}" type="button" data-action="select-network" data-network="${network}">
                  ${escapeHtml(network)}
                </button>
              `,
            )
            .join('')}
        </div>

        <div class="field top-space">
          <label class="eyebrow" for="social-template">Template</label>
          <textarea id="social-template" rows="6" data-input="social-template">${escapeHtml(state.socialTemplates[state.selectedNetwork])}</textarea>
        </div>
      </div>

      <div class="card">
        <p class="eyebrow">Preview</p>
        <div class="text-preview">${escapeHtml(state.socialTemplates[state.selectedNetwork])}</div>
      </div>
    </section>
  `
}

function renderSummary() {
  return `
    <section class="card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Summary</p>
          <h2>${escapeHtml(getJob().title)}</h2>
        </div>
      </div>

      <div class="summary-list">
        <div class="summary-row"><span>Mode</span><strong>${state.publishMode}</strong></div>
        <div class="summary-row"><span>Captions</span><strong>${state.captionsEnabled ? 'On' : 'Off'}</strong></div>
        <div class="summary-row"><span>Default music</span><strong>${escapeHtml(getTrack().name)}</strong></div>
        <div class="summary-row"><span>Poster text</span><strong>${escapeHtml(state.posterText)}</strong></div>
        <div class="summary-row"><span>Voiceover</span><strong>${state.recordingUrl ? 'Ready' : 'Missing'}</strong></div>
      </div>

      <button class="primary-button full" type="button" data-action="approve-job" data-job-id="${getJob().id}">
        ${state.publishMode === 'auto' ? 'Publish' : 'Send to approval'}
      </button>
    </section>
  `
}

function renderPage() {
  if (state.activeTab === 'dashboard') return renderDashboard()
  if (state.activeTab === 'music') return renderMusic()
  if (state.activeTab === 'reel') return renderReel()
  if (state.activeTab === 'poster') return renderPoster()
  if (state.activeTab === 'voiceover') return renderVoiceover()
  if (state.activeTab === 'social') return renderSocial()
  return renderSummary()
}

function renderApp() {
  syncState()

  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main">
        ${renderHeader()}
        <div class="page">
          ${renderPage()}
        </div>
      </main>
    </div>
  `
}

function reorderSlides(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return
  const sourceIndex = state.slides.findIndex((slide) => slide.id === sourceId)
  const targetIndex = state.slides.findIndex((slide) => slide.id === targetId)
  if (sourceIndex === -1 || targetIndex === -1) return

  const updated = [...state.slides]
  const [moved] = updated.splice(sourceIndex, 1)
  updated.splice(targetIndex, 0, moved)
  state.slides = updated
}

function toneFromName(name) {
  const tones = ['sky', 'sand', 'green', 'blue']
  return tones[name.length % tones.length]
}

function addSlides(fileList) {
  const files = Array.from(fileList).filter(
    (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
  )
  if (!files.length) return

  const slides = files.map((file) => ({
    id: createId('slide'),
    name: file.name.replace(/\.[^.]+$/, ''),
    type: file.type.startsWith('video/') ? 'video' : 'image',
    caption: 'New caption',
    previewUrl: URL.createObjectURL(file),
    tone: toneFromName(file.name),
  }))

  state.slides = [...state.slides, ...slides]
  state.selectedSlideId = slides[0].id
  renderApp()
}

function addTracks(fileList) {
  const files = Array.from(fileList).filter(
    (file) => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name),
  )
  if (!files.length) return

  const tracks = files.map((file) => ({
    id: createId('track'),
    name: file.name.replace(/\.[^.]+$/, ''),
    liked: true,
    uploaded: true,
  }))

  state.tracks = [...state.tracks, ...tracks]
  state.selectedTrackId = tracks[0].id
  renderApp()
}

function setPosterVideo(file) {
  if (!file || !file.type.startsWith('video/')) return
  state.posterVideoEnabled = true
  renderApp()
}

async function startRecording() {
  if (!state.recordingSupported || state.recordingState === 'recording') return

  try {
    recordedChunks = []
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(recordingStream)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data)
    }

    mediaRecorder.onstop = () => {
      if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl)
      const blob = new Blob(recordedChunks, { type: 'audio/webm' })
      state.recordingUrl = URL.createObjectURL(blob)
      state.recordingState = 'ready'
      state.recordingSeconds = 0
      if (recordingStream) recordingStream.getTracks().forEach((track) => track.stop())
      recordingStream = null
      renderApp()
    }

    mediaRecorder.start()
    state.recordingState = 'recording'
    state.recordingSeconds = 0
    if (recordingTimer) clearInterval(recordingTimer)
    recordingTimer = window.setInterval(() => {
      state.recordingSeconds += 1
      renderApp()
    }, 1000)
    renderApp()
  } catch {
    state.recordingState = 'blocked'
    renderApp()
  }
}

function stopRecording() {
  if (!mediaRecorder || state.recordingState !== 'recording') return
  if (recordingTimer) clearInterval(recordingTimer)
  recordingTimer = null
  mediaRecorder.stop()
}

function clearRecording() {
  if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl)
  state.recordingUrl = ''
  state.recordingState = 'idle'
  state.recordingSeconds = 0
  renderApp()
}

function handleClick(event) {
  const target = event.target.closest('[data-action]')
  if (!target) return

  const action = target.dataset.action

  if (action === 'switch-tab') state.activeTab = target.dataset.tabId
  if (action === 'set-mode') state.publishMode = target.dataset.mode
  if (action === 'select-job') state.selectedJobId = target.dataset.jobId
  if (action === 'approve-job') {
    const job = state.jobs.find((item) => item.id === target.dataset.jobId)
    if (job) job.status = 'Published'
  }
  if (action === 'toggle-random') state.randomMusic = !state.randomMusic
  if (action === 'select-track') state.selectedTrackId = target.dataset.trackId
  if (action === 'toggle-like') {
    const track = state.tracks.find((item) => item.id === target.dataset.trackId)
    if (track) track.liked = !track.liked
  }
  if (action === 'set-default-track') state.defaultTrackId = target.dataset.trackId
  if (action === 'toggle-reel-defaults') state.reelDefaults = !state.reelDefaults
  if (action === 'set-end-position') state.reelEndPosition = target.dataset.position
  if (action === 'select-slide') state.selectedSlideId = target.dataset.slideId
  if (action === 'move-slide-up' || action === 'move-slide-down') {
    const currentIndex = state.slides.findIndex((slide) => slide.id === target.dataset.slideId)
    const nextIndex = action === 'move-slide-up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex >= 0 && nextIndex >= 0 && nextIndex < state.slides.length) {
      reorderSlides(target.dataset.slideId, state.slides[nextIndex].id)
    }
  }
  if (action === 'toggle-captions') state.captionsEnabled = !state.captionsEnabled
  if (action === 'set-poster-status') {
    state.posterStatus = target.dataset.status
    state.posterText = target.dataset.status
  }
  if (action === 'toggle-poster-video') state.posterVideoEnabled = !state.posterVideoEnabled
  if (action === 'start-recording') {
    startRecording()
    return
  }
  if (action === 'stop-recording') {
    stopRecording()
    return
  }
  if (action === 'clear-recording') clearRecording()
  if (action === 'select-network') state.selectedNetwork = target.dataset.network

  renderApp()
}

function handleInput(event) {
  const target = event.target

  if (target.dataset.upload === 'slides') {
    addSlides(target.files)
    target.value = ''
    return
  }

  if (target.dataset.upload === 'music') {
    addTracks(target.files)
    target.value = ''
    return
  }

  if (target.dataset.upload === 'poster-video') {
    setPosterVideo(target.files[0])
    target.value = ''
    return
  }

  if (target.dataset.input === 'slide-caption') {
    const slide = getSlide()
    slide.caption = target.value
  }

  if (target.dataset.input === 'poster-text') {
    state.posterText = target.value
  }

  if (target.dataset.input === 'voice-notes') {
    state.voiceNotes = target.value
  }

  if (target.dataset.input === 'social-template') {
    state.socialTemplates[state.selectedNetwork] = target.value
  }

  renderApp()
}

function clearDragState() {
  app.querySelectorAll('.is-drop-target, .is-dragover, .is-dragging').forEach((node) => {
    node.classList.remove('is-drop-target', 'is-dragover', 'is-dragging')
  })
}

function handleDragStart(event) {
  const row = event.target.closest('[data-slide-row]')
  if (!row) return
  dragSlideId = row.dataset.slideId
  row.classList.add('is-dragging')
  event.dataTransfer.effectAllowed = 'move'
}

function handleDragOver(event) {
  const dropzone = event.target.closest('[data-dropzone]')
  if (dropzone) {
    event.preventDefault()
    dropzone.classList.add('is-dragover')
    return
  }

  const row = event.target.closest('[data-slide-row]')
  if (!row || !dragSlideId || row.dataset.slideId === dragSlideId) return
  event.preventDefault()
  clearDragState()
  row.classList.add('is-drop-target')
}

function handleDrop(event) {
  const dropzone = event.target.closest('[data-dropzone]')
  if (dropzone) {
    event.preventDefault()
    if (dropzone.dataset.dropzone === 'slides') addSlides(event.dataTransfer.files)
    if (dropzone.dataset.dropzone === 'music') addTracks(event.dataTransfer.files)
    if (dropzone.dataset.dropzone === 'poster-video') setPosterVideo(event.dataTransfer.files[0])
    clearDragState()
    return
  }

  const row = event.target.closest('[data-slide-row]')
  if (!row || !dragSlideId) return
  event.preventDefault()
  reorderSlides(dragSlideId, row.dataset.slideId)
  dragSlideId = null
  renderApp()
}

app.addEventListener('click', handleClick)
app.addEventListener('input', handleInput)
app.addEventListener('change', handleInput)
app.addEventListener('dragstart', handleDragStart)
app.addEventListener('dragover', handleDragOver)
app.addEventListener('dragend', clearDragState)
app.addEventListener('drop', handleDrop)

renderApp()

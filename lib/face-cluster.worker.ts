import { clusterDetectedFaces, type DetectedFaceRecord } from './face-recognition'

// Only numerical descriptors/boxes cross into the worker. Avatar images remain
// on the UI thread, and results refer back to the original face records by ID.
const channel = self as unknown as {
  onmessage: ((event: MessageEvent<{ faces: DetectedFaceRecord[]; threshold: number }>) => void) | null
  postMessage: (value: unknown) => void
}
channel.onmessage = event => {
  try {
    const clusters = clusterDetectedFaces(event.data.faces, event.data.threshold).map(({ faces, avatarDataUrl: _avatar, ...cluster }) => ({
      ...cluster, faceIds: faces.map(face => face.faceId),
    }))
    channel.postMessage({ clusters })
  } catch {
    channel.postMessage({ error: true })
  }
}

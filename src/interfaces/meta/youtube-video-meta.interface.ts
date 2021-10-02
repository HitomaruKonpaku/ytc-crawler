import { YoutubeAuthorMeta } from './youtube-author-meta.interface'

export interface YoutubeVideoMeta {
  url?: string
  name?: string
  description?: string
  paid?: string
  channelId?: string
  videoId?: string
  duration?: string
  unlisted?: string
  author?: YoutubeAuthorMeta
  thumbnailUrl?: string
  embedUrl?: string
  playerType?: string
  width?: string
  height?: string
  isFamilyFriendly?: string
  regionsAllowed?: string
  interactionCount?: string
  datePublished?: string
  uploadDate?: string
  genre?: string
}

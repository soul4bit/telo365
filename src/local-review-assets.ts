/**
 * Development-only delivery for unapproved review assets.
 *
 * The Vite middleware exists only while `vite` is running locally. Production
 * builds receive neither the assets nor a route that can resolve this URL.
 */
const localHost=()=>typeof window!=='undefined'&&['localhost','127.0.0.1'].includes(window.location.hostname)
const viteDevelopment=(import.meta as ImportMeta&{env?:{DEV?:boolean}}).env?.DEV===true

export const isLocalReviewEnvironment=()=>viteDevelopment&&localHost()

export const localReviewAssetUrl=(path:string)=>isLocalReviewEnvironment()
  ?`/__telo365-local-review-assets/${path.split('/').map(encodeURIComponent).join('/')}`
  :null

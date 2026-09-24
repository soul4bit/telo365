import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const reviewPrefix='/__telo365-local-review-assets/'
const reviewRoot=resolve(import.meta.dirname,'assets-work/mixamo-review')
const isLoopback=(address:string|undefined)=>address==='127.0.0.1'||address==='::1'||address==='::ffff:127.0.0.1'

/** Vite-only endpoint. Its source directory is never copied to dist. */
const localReviewAssets={
  name:'telo365-local-review-assets',
  configureServer(server:any){
    server.middlewares.use((request:any,response:any,next:any)=>{
      const pathname=new URL(request.url||'/', 'http://local').pathname
      if(!pathname.startsWith(reviewPrefix))return next()
      if(!isLoopback(request.socket?.remoteAddress)){response.statusCode=403;return response.end()}
      if(request.method!=='GET'&&request.method!=='HEAD'){response.statusCode=405;return response.end()}
      let filename:string
      try{filename=resolve(reviewRoot,decodeURIComponent(pathname.slice(reviewPrefix.length)))}catch{response.statusCode=400;return response.end()}
      if(!filename.startsWith(reviewRoot+sep)||!filename.endsWith('.glb')){response.statusCode=404;return response.end()}
      try{if(!statSync(filename).isFile())throw new Error('missing')}catch{response.statusCode=404;return response.end()}
      response.statusCode=200
      response.setHeader('Content-Type','model/gltf-binary')
      response.setHeader('Cache-Control','no-store')
      if(request.method==='HEAD')return response.end()
      createReadStream(filename).on('error',()=>response.destroy()).pipe(response)
    })
  }
}

export default defineConfig({ plugins: [react(),localReviewAssets], server: { host:'127.0.0.1', proxy: { '/api': { target: 'http://127.0.0.1:1435', changeOrigin: false } } } })

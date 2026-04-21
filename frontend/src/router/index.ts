import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/artists', name: 'artists', component: () => import('@/views/ArtistsView.vue') },
    { path: '/albums', name: 'albums', component: () => import('@/views/AlbumsView.vue') },
    { path: '/tracks', name: 'tracks', component: () => import('@/views/TracksView.vue') },
    { path: '/tags', name: 'tags', component: () => import('@/views/TagsView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    
    // 💉 이 두 줄이 모두 살아있어야 합니다!
    { 
      path: '/artist/:id', 
      name: 'artist-detail', 
      component: () => import('@/views/ArtistDetail.vue') 
    },
    { 
      path: '/album/:id', 
      name: 'album-detail', 
      component: () => import('@/views/AlbumDetail.vue') 
    }
  ]
})

export default router
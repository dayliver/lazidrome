import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/artists', name: 'artists', component: () => import('@/views/ArtistsView.vue') },
    { path: '/albums', name: 'albums', component: () => import('@/views/AlbumsView.vue') },
    { path: '/tracks', name: 'tracks', component: () => import('@/views/TracksView.vue') },
    { path: '/genres', name: 'genres', component: () => import('@/views/GenresView.vue') },
    { path: '/tags', name: 'tags', component: () => import('@/views/TagsView.vue') },
    {
      path: '/tags/:name',
      name: 'tag-detail',
      component: () => import('@/views/details/TagDetail.vue')
    },
    { path: '/playlists', name: 'playlists', component: () => import('@/views/PlaylistsView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    
    // 💉 이 두 줄이 모두 살아있어야 합니다!
    { 
      path: '/artist/:id', 
      name: 'artist-detail', 
      component: () => import('@/views/details/ArtistDetail.vue') 
    },
    { 
      path: '/album/:id', 
      name: 'album-detail', 
      component: () => import('@/views/details/AlbumDetail.vue') 
    },
    { 
      path: '/playlist/:id', 
      name: 'playlist-detail', 
      component: () => import('@/views/details/PlaylistDetail.vue') 
    }
  ]
})

export default router
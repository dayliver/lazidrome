import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    {
      path: '/artists',
      name: 'artists',
      component: () => import('@/views/ArtistsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/albums',
      name: 'albums',
      component: () => import('@/views/AlbumsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/charts',
      name: 'charts',
      component: () => import('@/views/charts/ChartsOverview.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/charts/weekly',
      name: 'charts-weekly',
      component: () => import('@/views/charts/ChartsDetail.vue'),
      meta: { requiresAuth: true, chartPeriod: 'weekly' },
    },
    {
      path: '/charts/monthly',
      name: 'charts-monthly',
      component: () => import('@/views/charts/ChartsDetail.vue'),
      meta: { requiresAuth: true, chartPeriod: 'monthly' },
    },
    {
      path: '/charts/alltime',
      name: 'charts-alltime',
      component: () => import('@/views/charts/ChartsDetail.vue'),
      meta: { requiresAuth: true, chartPeriod: 'alltime' },
    },
    {
      path: '/tracks',
      name: 'tracks',
      component: () => import('@/views/TracksView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tags',
      name: 'tags',
      component: () => import('@/views/TagsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tags/:name',
      name: 'tag-detail',
      component: () => import('@/views/details/TagDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/playlists',
      name: 'playlists',
      component: () => import('@/views/PlaylistsView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/artist/:id',
      name: 'artist-detail',
      component: () => import('@/views/details/ArtistDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/album/:id',
      name: 'album-detail',
      component: () => import('@/views/details/AlbumDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/playlist/:id',
      name: 'playlist-detail',
      component: () => import('@/views/details/PlaylistDetail.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

export default router

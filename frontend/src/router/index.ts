import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true, titleKey: 'pages.home.title' },
    },
    {
      path: '/artists',
      name: 'artists',
      component: () => import('@/views/ArtistsView.vue'),
      meta: { requiresAuth: true, titleKey: 'pages.artists.title' },
    },
    {
      path: '/albums',
      name: 'albums',
      component: () => import('@/views/AlbumsView.vue'),
      meta: { requiresAuth: true, titleKey: 'pages.albums.title' },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { requiresAuth: true, titleKey: 'stats.title' },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/PlayHistoryView.vue'),
      meta: { requiresAuth: true, titleKey: 'history.title' },
    },
    {
      path: '/charts',
      name: 'charts',
      component: () => import('@/views/charts/ChartsOverview.vue'),
      meta: { requiresAuth: true, titleKey: 'charts.title' },
    },
    {
      path: '/charts/weekly',
      name: 'charts-weekly',
      component: () => import('@/views/charts/ChartsDetail.vue'),
      meta: { requiresAuth: true, chartPeriod: 'weekly', titleKey: 'charts.weekly.title' },
    },
    {
      path: '/charts/monthly',
      name: 'charts-monthly',
      component: () => import('@/views/charts/ChartsDetail.vue'),
      meta: { requiresAuth: true, chartPeriod: 'monthly', titleKey: 'charts.monthly.title' },
    },
    {
      path: '/charts/alltime',
      name: 'charts-alltime',
      component: () => import('@/views/charts/ChartsDetail.vue'),
      meta: { requiresAuth: true, chartPeriod: 'alltime', titleKey: 'charts.alltime.title' },
    },
    {
      path: '/tracks',
      name: 'tracks',
      component: () => import('@/views/TracksView.vue'),
      meta: { requiresAuth: true, titleKey: 'pages.tracks.title' },
    },
    {
      path: '/tags',
      name: 'tags',
      component: () => import('@/views/TagsView.vue'),
      meta: { requiresAuth: true, titleKey: 'pages.tags.title' },
    },
    {
      path: '/tags/:name',
      name: 'tag-detail',
      component: () => import('@/views/details/TagDetail.vue'),
      meta: { requiresAuth: true, dynamicTitle: true },
    },
    {
      path: '/playlists',
      name: 'playlists',
      component: () => import('@/views/PlaylistsView.vue'),
      meta: { requiresAuth: true, titleKey: 'pages.playlists.title' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { titleKey: 'settings.title' },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true, titleKey: 'admin.title' },
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('@/views/ImportView.vue'),
      meta: { requiresAuth: true, titleKey: 'import.title' },
      beforeEnter: (to) => {
        if (to.query.tab === 'files') return { name: 'upload', replace: true }
      },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/views/UploadView.vue'),
      meta: { requiresAuth: true, titleKey: 'upload.title' },
    },
    {
      path: '/download',
      redirect: (to) => ({ name: 'import', query: to.query }),
    },
    {
      path: '/files',
      name: 'files',
      component: () => import('@/views/FilesView.vue'),
      meta: { requiresAuth: true, titleKey: 'files.title' },
    },
    {
      path: '/artist/:id',
      name: 'artist-detail',
      component: () => import('@/views/details/ArtistDetail.vue'),
      meta: { requiresAuth: true, dynamicTitle: true },
    },
    {
      path: '/album/:id',
      name: 'album-detail',
      component: () => import('@/views/details/AlbumDetail.vue'),
      meta: { requiresAuth: true, dynamicTitle: true },
    },
    {
      path: '/track/:id',
      name: 'track-detail',
      component: () => import('@/views/details/TrackDetail.vue'),
      meta: { requiresAuth: true, dynamicTitle: true },
    },
    {
      path: '/playlist/:id',
      name: 'playlist-detail',
      component: () => import('@/views/details/PlaylistDetail.vue'),
      meta: { requiresAuth: true, dynamicTitle: true },
    },
  ],
})

export default router

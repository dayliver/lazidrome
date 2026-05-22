<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { notify } from '@/lib/notify'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useThemeStore } from '@/stores/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import {
  Sparkles,
  Server,
  RefreshCw,
  LogIn,
  LogOut,
  Moon,
  Sun,
  CheckCircle2,
  Circle,
  Package,
} from 'lucide-vue-next'
import {
  fetchFrontendBuildInfo,
  fetchBackendBuildFromHealth,
  formatBuildTime,
  compareBuilds,
} from '@/lib/buildInfo'

const auth = useAuthStore()
const library = useLibraryStore()
const theme = useThemeStore()

const adminPassword = ref('')
const settingsLoading = ref(false)

const lastfm = computed(() => library.serverSettings?.lastfm ?? null)
const frontendBuild = ref(null)
const backendBuildRef = ref(null)
const backendBuild = computed(
  () => backendBuildRef.value ?? library.serverSettings?.build ?? null
)
const buildCompare = computed(() => compareBuilds(frontendBuild.value, backendBuild.value))

const buildStatusClass = computed(() => {
  const s = buildCompare.value.status
  if (s === 'ok') return 'text-primary border-primary/30 bg-primary/5'
  if (s === 'mismatch') return 'text-destructive border-destructive/30 bg-destructive/5'
  if (s === 'skew') return 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
  return 'text-muted-foreground border-border bg-muted/30'
})

const refreshBackendBuild = async () => {
  backendBuildRef.value = await fetchBackendBuildFromHealth(auth.serverUrl)
}

onMounted(async () => {
  frontendBuild.value = await fetchFrontendBuildInfo()
  void refreshBackendBuild()
})

const loadServerSettings = async () => {
  if (!auth.isAuthenticated) return
  settingsLoading.value = true
  try {
    await library.fetchServerSettings()
    await refreshBackendBuild()
  } catch (e) {
    console.error('설정 조회 실패:', e)
  } finally {
    settingsLoading.value = false
  }
}

watch(
  () => auth.isAuthenticated,
  (ok) => {
    if (ok) void loadServerSettings()
    else library.serverSettings = null
  },
  { immediate: true }
)

const handleLogin = async () => {
  const result = await auth.login(adminPassword.value)
  if (result.success) {
    adminPassword.value = ''
    await library.fetchLibrary()
    await loadServerSettings()
  } else {
    notify.error(result.message || '로그인에 실패했습니다.')
  }
}

const handleLogout = () => {
  if (confirm('로그아웃 하시겠습니까?')) {
    auth.logout()
  }
}

const handleRefresh = async () => {
  await library.fetchLibrary()
  await loadServerSettings()
}
</script>

<template>
  <div class="container max-w-2xl py-10 space-y-8">

    <div class="space-y-2">
      <h1 class="text-3xl font-black tracking-tight">Settings</h1>
      <p class="text-muted-foreground">서버 연결 및 개인 설정을 관리합니다.</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Package class="w-5 h-5 text-primary" />
          배포 · 버전
        </CardTitle>
        <CardDescription>
          이 화면(프론트)과 API 서버(백엔드)가 같은 <code>npm run deploy</code> 결과인지 확인합니다.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2 text-sm">
          <div class="rounded-lg border p-3 bg-muted/20">
            <p class="text-xs font-bold uppercase text-muted-foreground mb-1">프론트엔드</p>
            <p class="font-mono font-semibold">v{{ frontendBuild?.version ?? '—' }}</p>
            <p class="text-muted-foreground text-xs mt-1">빌드: {{ formatBuildTime(frontendBuild?.builtAt) }}</p>
          </div>
          <div class="rounded-lg border p-3 bg-muted/20">
            <p class="text-xs font-bold uppercase text-muted-foreground mb-1">백엔드 API</p>
            <template v-if="!settingsLoading">
              <p class="font-mono font-semibold">v{{ backendBuild?.version ?? '—' }}</p>
              <p class="text-muted-foreground text-xs mt-1">배포: {{ formatBuildTime(backendBuild?.builtAt) }}</p>
              <p
                v-if="!backendBuild?.builtAt"
                class="text-xs text-amber-600 dark:text-amber-400 mt-1"
              >
                build-info.json 없음 — npm run deploy 후 deploy:restart 확인
              </p>
            </template>
            <p v-else class="text-xs text-muted-foreground">확인 중…</p>
          </div>
        </div>
        <p
          class="text-sm rounded-lg border px-3 py-2"
          :class="buildStatusClass"
        >
          {{ buildCompare.message }}
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <component :is="theme.isDark ? Moon : Sun" class="w-5 h-5 text-primary" />
          화면 테마
        </CardTitle>
        <CardDescription>라이트/다크 모드를 전환합니다.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex items-center gap-2">
          <Button
            :variant="theme.mode === 'light' ? 'default' : 'outline'"
            size="sm"
            :class="theme.mode === 'light' ? 'font-bold shadow-sm' : ''"
            @click="theme.setMode('light')"
          >
            라이트
          </Button>
          <Button
            :variant="theme.mode === 'dark' ? 'default' : 'outline'"
            size="sm"
            :class="theme.mode === 'dark' ? 'font-bold shadow-sm' : ''"
            @click="theme.setMode('dark')"
          >
            다크
          </Button>
          <Button
            :variant="theme.mode === 'system' ? 'default' : 'outline'"
            size="sm"
            :class="theme.mode === 'system' ? 'font-bold shadow-sm' : ''"
            @click="theme.setMode('system')"
          >
            시스템
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><Server class="w-5 h-5 text-primary"/> 서버 연결</CardTitle>
        <CardDescription>Lazidrome 백엔드 주소와 마스터 비밀번호를 입력하세요.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="url">서버 주소</Label>
          <Input
            id="url"
            v-model="auth.serverUrl"
            placeholder="개발: 비워 두기 (Vite가 /api → 5294). 직접 연결 시 http://localhost:5294"
          />
          <p class="text-xs text-muted-foreground">
            <code>npm run dev</code>로 <strong>localhost:3000</strong>에 접속할 때는 서버 주소를 비워 두는 것이 가장 간단합니다.
          </p>
        </div>

        <div v-if="!auth.isAuthenticated" class="space-y-2">
          <Label for="pw">마스터 비밀번호</Label>
          <div class="flex gap-2">
            <Input id="pw" v-model="adminPassword" type="password" placeholder="비밀번호 입력" @keyup.enter="handleLogin" />
            <Button @click="handleLogin">
              <LogIn class="w-4 h-4 mr-2"/> 로그인
            </Button>
          </div>
        </div>

        <div v-else class="p-4 bg-primary/5 rounded-lg border border-primary/20 flex justify-between items-center">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-primary uppercase">인증 상태</span>
            <span class="text-sm font-medium">연결됨 (Admin 세션)</span>
          </div>
          <Button variant="outline" size="sm" @click="handleLogout">
            <LogOut class="w-4 h-4 mr-2"/> 로그아웃
          </Button>
        </div>
      </CardContent>
      <CardFooter v-if="auth.isAuthenticated" class="flex items-center justify-between border-t px-6 py-4 bg-muted/10">
        <div class="text-sm font-medium text-muted-foreground">
          라이브러리: <strong>{{ library.trackCount }}</strong>곡
        </div>
        <Button @click="handleRefresh" :disabled="library.isSyncing" variant="secondary">
          <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': library.isSyncing }" />
          라이브러리 새로고침
        </Button>
      </CardFooter>
    </Card>

    <Card class="border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><Sparkles class="w-5 h-5 text-primary"/> Last.fm (서버 설정)</CardTitle>
        <CardDescription>
          API 키·스크롭은 브라우저가 아니라 백엔드 <code>.env</code>에서 설정합니다.
          트랙·앨범·아티스트 상세의 메타데이터 편집에서 Last.fm 보강을 사용할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent v-if="auth.isAuthenticated" class="space-y-3">
        <p v-if="settingsLoading" class="text-sm text-muted-foreground">서버 설정 확인 중…</p>
        <template v-else-if="lastfm">
          <div class="flex items-start gap-3 text-sm">
            <CheckCircle2 v-if="lastfm.enrich" class="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <Circle v-else class="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p class="font-medium">메타데이터 보강 (enrich)</p>
              <p class="text-muted-foreground text-xs">
                {{ lastfm.enrich ? 'LASTFM_API_KEY 설정됨' : 'LASTFM_API_KEY 없음 — .env에 추가 후 서버 재시작' }}
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3 text-sm">
            <CheckCircle2 v-if="lastfm.scrobble" class="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <Circle v-else class="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p class="font-medium">재생 스크롭 (scrobble)</p>
              <p class="text-muted-foreground text-xs">
                {{ lastfm.scrobble
                  ? 'API Key + Secret + Session Key 모두 설정됨'
                  : '스크롭은 API Key·Secret·Session Key 세 값이 모두 필요합니다' }}
              </p>
            </div>
          </div>
        </template>
        <p class="text-xs text-muted-foreground">
          설정 방법은 저장소 <code>backend/README.md</code>의 Last.fm 절을 참고하세요.
        </p>
      </CardContent>
      <CardContent v-else class="text-sm text-muted-foreground">
        로그인 후 서버의 Last.fm 연동 상태를 확인할 수 있습니다.
      </CardContent>
    </Card>

  </div>
</template>

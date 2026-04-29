<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useThemeStore } from '@/stores/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Sparkles, Server, Save, RefreshCw, LogIn, LogOut, Moon, Sun } from 'lucide-vue-next'

const auth = useAuthStore()
const library = useLibraryStore()
const theme = useThemeStore()

// 💉 수술 1: 로그인용 임시 비밀번호 상태
const adminPassword = ref('')
const isEnriching = ref(false)

// 💉 수술 2: 로그인/로그아웃 처리
const handleLogin = async () => {
  const result = await auth.login(adminPassword.value)
  if (result.success) {
    adminPassword.value = ''
    await library.fetchLibrary() // 로그인 성공 시 라이브러리 로드
  } else {
    alert(result.message)
  }
}

const handleLogout = () => {
  if (confirm('로그아웃 하시겠습니까?')) {
    auth.logout()
  }
}

// 💉 수술 3: 라이브러리 새로고침 (기존 syncLibrary 대체)
const handleRefresh = async () => {
  await library.fetchLibrary()
}

const saveLastFm = () => {
  auth.saveLastFmKey(auth.lastFmApiKey)
  alert('Last.fm API 키가 저장되었습니다.')
}

const handleEnrich = async () => {
  if (!auth.lastFmApiKey) return alert('Last.fm API 키를 먼저 입력하고 저장해주세요.')
  const confirmStart = confirm('라이브러리 데이터를 강화하시겠습니까?')
  if (!confirmStart) return

  isEnriching.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    alert('데이터 강화 기능은 다음 스텝에서 구현됩니다!')
  } finally {
    isEnriching.value = false
  }
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
          <Input id="url" v-model="auth.serverUrl" placeholder="http://localhost:5294" />
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
          라이브러리: <strong>{{ library.trackCount }}</strong> 곡 로드됨
        </div>
        <Button @click="handleRefresh" :disabled="library.isSyncing" variant="secondary">
          <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': library.isSyncing }" />
          라이브러리 새로고침
        </Button>
      </CardFooter>
    </Card>

    <Card class="border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><Sparkles class="w-5 h-5 text-primary"/> 데이터 연동 (선택)</CardTitle>
        <CardDescription>
          Last.fm API를 통해 곡의 메타데이터와 분위기 태그를 보강할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex gap-2">
          <div class="space-y-2 flex-1">
            <Label for="lastfm">Last.fm API Key</Label>
            <Input id="lastfm" v-model="auth.lastFmApiKey" placeholder="API 키를 입력하세요" />
          </div>
          <div class="flex items-end pb-0.5">
            <Button variant="secondary" @click="saveLastFm">
              <Save class="w-4 h-4 mr-2"/> 저장
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter v-if="auth.isAuthenticated" class="border-t px-6 py-4 bg-primary/5">
        <Button class="w-full font-bold" @click="handleEnrich" :disabled="!auth.lastFmApiKey || isEnriching">
          <Sparkles class="w-4 h-4 mr-2" :class="{ 'animate-pulse': isEnriching }" />
          {{ isEnriching ? '데이터 분석 중...' : '라이브러리 데이터 강화 (Enrich)' }}
        </Button>
      </CardFooter>
    </Card>

    </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UserPlus, Trash2, User, Mic, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLibraryStore } from '@/stores/library'
import { notify } from '@/lib/notify'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['update:modelValue'])

const library = useLibraryStore()
const { t } = useI18n()

const searchQuery = ref('')
const searchResults = ref([])
const isFocused = ref(false)

const ROLE_MAP = computed(() => [
  { value: 1, label: t('metadata.roleVocal') },
  { value: 2, label: t('metadata.roleLyricist') },
  { value: 4, label: t('metadata.roleComposer') },
  { value: 8, label: t('metadata.roleArranger') },
  { value: 16, label: t('metadata.roleFeatured') },
  { value: 32, label: t('metadata.roleProducer') }
])

const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }
  searchResults.value = await library.searchArtists(query, 5)
}

const addArtist = (artistOrName) => {
  let id = null
  let name = ''

  if (typeof artistOrName === 'string') {
    name = artistOrName.trim()
    if (!name) return
  } else {
    id = artistOrName.id
    name = artistOrName.name
  }

  if (props.modelValue.some(a => a.name.toLowerCase() === name.toLowerCase())) {
    notify.warning(t('metadata.artistAlreadyAdded'))
    searchQuery.value = ''
    searchResults.value = []
    return
  }

  const updated = [...props.modelValue, { id, name, role_mask: 1 }]
  emit('update:modelValue', updated)

  searchQuery.value = ''
  searchResults.value = []
  isFocused.value = false
}

const removeArtist = (index) => {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

const getActiveRoles = (mask) => {
  return ROLE_MAP.value.filter(r => (mask & r.value) === r.value).map(r => String(r.value))
}

const updateRoles = (artist, newRolesArray) => {
  if (!newRolesArray || newRolesArray.length === 0) {
    artist.role_mask = 1
  } else {
    artist.role_mask = newRolesArray.reduce((acc, val) => acc | parseInt(val, 10), 0)
  }
  emit('update:modelValue', [...props.modelValue])
}

const handleBlur = () => {
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-300 relative h-full">

    <div class="bg-muted/30 p-4 rounded-xl border relative z-20">
      <label class="text-xs font-bold text-muted-foreground uppercase block mb-2">{{ t('metadata.artistSearchAdd') }}</label>
      <div class="relative">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              :placeholder="t('metadata.artistSearchPlaceholder')"
              class="bg-background pl-9"
              @input="handleSearch"
              @focus="isFocused = true"
              @blur="handleBlur"
              @keyup.enter="addArtist(searchQuery)"
            />
          </div>
          <Button @click="addArtist(searchQuery)" variant="default" class="shrink-0 font-bold" :disabled="!searchQuery.trim()">
            <UserPlus class="w-4 h-4 mr-2" /> {{ t('metadata.createNew') }}
          </Button>
        </div>

        <div v-if="isFocused && searchQuery.trim()" class="absolute top-full left-0 right-[100px] mt-1 bg-card border rounded-md shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">

          <div v-if="searchResults.length > 0">
            <button
              v-for="res in searchResults"
              :key="res.id"
              @click.stop="addArtist(res)"
              class="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center justify-between group transition-colors"
            >
              <span class="font-bold">{{ res.name }}</span>
              <span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {{ t('metadata.linkExisting') }}
              </span>
            </button>
          </div>

          <div v-if="!searchResults.some(r => r.name.toLowerCase() === searchQuery.trim().toLowerCase())" class="border-t bg-muted/30">
            <button
              @click.stop="addArtist(searchQuery)"
              class="w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-muted/80 flex items-center gap-2"
            >
              <UserPlus class="w-4 h-4" /> {{ t('metadata.createArtistAs', { name: searchQuery }) }}
            </button>
          </div>

        </div>
      </div>
    </div>

    <div class="space-y-3 relative z-10 pb-8">
      <div v-if="modelValue.length === 0" class="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl">
        {{ t('metadata.noArtists') }}
      </div>

      <TransitionGroup name="list" tag="div" class="space-y-3">
        <div
          v-for="(artist, index) in modelValue"
          :key="artist.name + index"
          class="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4 transition-all hover:border-primary/50"
        >
          <div class="flex items-center justify-between border-b pb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Mic class="w-4 h-4" v-if="(artist.role_mask & 1) === 1 || (artist.role_mask & 16) === 16" />
                <User class="w-4 h-4" v-else />
              </div>
              <span class="font-bold text-lg">{{ artist.name }}</span>
              <span v-if="artist.id" class="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono">{{ t('metadata.dbLinked') }}</span>
              <span v-else class="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded font-bold">{{ t('metadata.newArtist') }}</span>
            </div>

            <Button variant="ghost" size="icon" @click="removeArtist(index)" class="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>

          <div class="flex flex-col gap-2">
            <p class="text-[10px] font-bold text-muted-foreground uppercase">{{ t('metadata.rolesLabel') }}</p>
            <div class="flex items-center justify-between">

              <ToggleGroup
                type="multiple"
                variant="outline"
                :model-value="getActiveRoles(artist.role_mask)"
                @update:model-value="(newVals) => updateRoles(artist, newVals)"
                class="justify-start flex-wrap gap-1"
              >
                <ToggleGroupItem
                  v-for="role in ROLE_MAP"
                  :key="role.value"
                  :value="String(role.value)"
                  class="text-xs h-8 px-3 font-bold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                >
                  {{ role.label }}
                </ToggleGroupItem>
              </ToggleGroup>

              <span class="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-1 rounded ml-4 shrink-0">
                {{ t('metadata.roleMaskLabel', { value: artist.role_mask }) }}
              </span>

            </div>
          </div>

        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-20px); }
</style>

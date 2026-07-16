<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, ref } from "vue"
import { useVModel } from "@vueuse/core"
import { cn } from "@/lib/utils"

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  class?: HTMLAttributes["class"]
  defaultValue?: string | number
  modelValue?: string | number
  showLineNumbers?: boolean
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
const scrollTop = ref(0)
const lineNumbers = computed(() => Array.from(
  { length: String(modelValue.value ?? "").split(/\r?\n/).length },
  (_, index) => index + 1,
).join("\n"))
</script>

<template>
  <div v-if="showLineNumbers" class="relative">
    <pre
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-px left-px w-12 overflow-hidden rounded-l-md border-r bg-muted/50 py-2 pr-2 text-right font-mono text-sm leading-6 text-muted-foreground select-none"
    ><span class="block" :style="{ transform: `translateY(-${scrollTop}px)` }">{{ lineNumbers }}</span></pre>
    <textarea
      v-bind="$attrs"
      v-model="modelValue"
      data-slot="textarea"
      :class="cn('border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent py-2 pr-3 pl-14 font-mono text-base leading-6 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', props.class)"
      @scroll="scrollTop = ($event.currentTarget as HTMLTextAreaElement).scrollTop"
    />
  </div>
  <textarea
    v-else
    v-bind="$attrs"
    v-model="modelValue"
    data-slot="textarea"
    :class="cn('border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', props.class)"
  />
</template>

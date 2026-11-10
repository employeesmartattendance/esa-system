<template>
  <AppLayout>
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </AppLayout>
</template>

<script setup>
import AppLayout from './components/layout/AppLayout.vue';
</script>

<style scoped>
/* App-level transitions */
</style>

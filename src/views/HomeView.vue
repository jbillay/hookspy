<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useAuth } from '../composables/use-auth.js'

const router = useRouter()
const toast = useToast()
const auth = useAuth()

const email = ref('')
const password = ref('')
const isLogin = ref(true)

async function handleSubmit() {
  if (!email.value || !password.value) return

  if (isLogin.value) {
    const { error } = await auth.signIn(email.value, password.value)
    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Invalid email or password',
        life: 5000,
      })
      return
    }
    router.push({ name: 'dashboard' })
  } else {
    if (password.value.length < 8) {
      toast.add({
        severity: 'warn',
        summary: 'Weak password',
        detail: 'Password must be at least 8 characters',
        life: 5000,
      })
      return
    }
    const { error, data } = await auth.signUp(email.value, password.value)
    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || error,
        life: 5000,
      })
      return
    }
    // If session is null, email confirmation is required
    if (data && !data.session) {
      toast.add({
        severity: 'success',
        summary: 'Check your inbox',
        detail: 'We sent you a confirmation email.',
        life: 8000,
      })
      return
    }
    router.push({ name: 'dashboard' })
  }
}

const currentYear = new Date().getFullYear()

const isDark = ref(
  typeof localStorage !== 'undefined' &&
    localStorage.getItem('hs-dark-mode') === 'true',
)

function toggleDarkMode() {
  isDark.value = !isDark.value
  localStorage.setItem('hs-dark-mode', isDark.value)
  document.documentElement.classList.toggle('dark-mode', isDark.value)
}
</script>

<template>
  <div class="landing-page">
    <!-- ============================== -->
    <!-- NAV -->
    <!-- ============================== -->
    <nav class="landing-nav">
      <div class="landing-container flex items-center justify-between h-16">
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style="background-color: var(--hs-brand)"
          >
            H
          </div>
          <span class="text-lg font-bold text-neutral-900 font-display"
            >HookSpy</span
          >
        </div>
        <div class="hidden sm:flex items-center gap-6 text-sm">
          <a
            href="#how-it-works"
            class="text-neutral-500 no-underline hover:text-neutral-900 transition-colors"
            >How it works</a
          >
          <a
            href="#features"
            class="text-neutral-500 no-underline hover:text-neutral-900 transition-colors"
            >Features</a
          >
          <a
            href="#pricing"
            class="text-neutral-500 no-underline hover:text-neutral-900 transition-colors"
            >Pricing</a
          >
          <button
            class="p-1.5 text-neutral-500 hover:text-neutral-700 transition-colors bg-transparent border-0 cursor-pointer"
            title="Toggle dark mode"
            @click="toggleDarkMode"
          >
            <i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" class="text-sm" />
          </button>
          <router-link
            to="/login"
            class="font-medium no-underline"
            style="color: var(--hs-brand)"
            >Sign in</router-link
          >
        </div>
      </div>
    </nav>

    <!-- ============================== -->
    <!-- HERO -->
    <!-- ============================== -->
    <section class="landing-hero">
      <div class="landing-container">
        <div
          class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          <!-- Left: Copy -->
          <div>
            <div
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style="
                background-color: var(--hs-brand-subtle);
                color: var(--hs-brand);
              "
            >
              <i class="pi pi-bolt text-xs" />
              Free during beta
            </div>

            <h1
              class="text-4xl sm:text-5xl font-bold text-neutral-900 font-display tracking-tight leading-tight mb-5"
            >
              Test webhooks
              <span style="color: var(--hs-brand)">locally,</span>
              <br />without the headaches
            </h1>

            <p class="text-lg text-neutral-500 leading-relaxed mb-8 max-w-lg">
              HookSpy gives you a public URL that captures incoming webhooks and
              relays them to your local dev server in real time &mdash; no CLI
              tools, no tunnels, just your browser.
            </p>

            <div class="flex flex-col sm:flex-row gap-3">
              <button
                class="btn-brand text-base px-6 py-3"
                @click="router.push({ name: 'register' })"
              >
                Start for free
                <i class="pi pi-arrow-right text-sm" />
              </button>
              <a
                href="#how-it-works"
                class="btn-outline inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-base font-semibold text-neutral-700 border-2 border-neutral-300 no-underline transition-all duration-200 hover:border-neutral-400 hover:shadow-sm"
                style="background-color: var(--hs-bg-surface)"
              >
                See how it works
                <i class="pi pi-arrow-down text-sm" />
              </a>
            </div>
          </div>

          <!-- Right: Redesigned auth form -->
          <div class="flex justify-center lg:justify-end">
            <div class="w-full max-w-sm">
              <div class="auth-card card-surface overflow-hidden shadow-lg">
                <!-- Form header with gradient accent -->
                <div class="auth-card-header">
                  <div class="flex items-center gap-3 mb-1">
                    <div
                      class="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                      style="background-color: rgba(255, 255, 255, 0.2)"
                    >
                      <i class="pi pi-user text-base" />
                    </div>
                    <div>
                      <h2 class="text-white text-base font-semibold m-0">
                        {{ isLogin ? 'Welcome back' : 'Get started' }}
                      </h2>
                      <p class="text-white/70 text-xs m-0 mt-0.5">
                        {{
                          isLogin
                            ? 'Sign in to your account'
                            : 'Create your free account'
                        }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="p-6 pt-5">
                  <!-- Auth mode toggle -->
                  <div
                    class="auth-toggle-track flex rounded-lg p-1 mb-5 border border-neutral-200"
                    style="background-color: var(--hs-bg-page)"
                  >
                    <button
                      class="auth-toggle-btn flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200"
                      :class="
                        isLogin
                          ? 'auth-toggle-active text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700 bg-transparent'
                      "
                      @click="isLogin = true"
                    >
                      Sign in
                    </button>
                    <button
                      class="auth-toggle-btn flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200"
                      :class="
                        !isLogin
                          ? 'auth-toggle-active text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700 bg-transparent'
                      "
                      @click="isLogin = false"
                    >
                      Create account
                    </button>
                  </div>

                  <form
                    class="flex flex-col gap-4"
                    @submit.prevent="handleSubmit"
                  >
                    <div class="flex flex-col gap-1.5">
                      <label
                        for="hero-email"
                        class="text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                        >Email</label
                      >
                      <InputText
                        id="hero-email"
                        v-model="email"
                        type="email"
                        placeholder="you@example.com"
                        class="w-full"
                      />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <label
                        for="hero-password"
                        class="text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                        >Password</label
                      >
                      <Password
                        id="hero-password"
                        v-model="password"
                        :feedback="!isLogin"
                        toggle-mask
                        input-class="w-full"
                      />
                    </div>

                    <Button
                      type="submit"
                      :label="isLogin ? 'Sign in' : 'Create account'"
                      :icon="isLogin ? 'pi pi-sign-in' : 'pi pi-user-plus'"
                      :loading="auth.loading"
                      :disabled="auth.loading"
                      class="w-full mt-1"
                    />
                  </form>

                  <!-- Divider -->
                  <div class="flex items-center gap-3 my-4">
                    <div
                      class="flex-1 h-px"
                      style="background-color: var(--hs-border)"
                    />
                    <span class="text-xs text-neutral-400">or</span>
                    <div
                      class="flex-1 h-px"
                      style="background-color: var(--hs-border)"
                    />
                  </div>

                  <router-link
                    :to="isLogin ? '/register' : '/login'"
                    class="block text-center text-sm font-medium no-underline transition-colors"
                    style="color: var(--hs-brand)"
                  >
                    {{
                      isLogin
                        ? "Don't have an account? Sign up"
                        : 'Already have an account? Sign in'
                    }}
                  </router-link>
                </div>
              </div>
              <p class="text-center text-xs text-neutral-400 mt-4">
                No credit card required. Free forever during beta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- HOW IT WORKS -->
    <!-- ============================== -->
    <section id="how-it-works" class="py-20 sm:py-24">
      <div class="landing-container">
        <div class="text-center mb-14">
          <h2
            class="text-3xl sm:text-4xl font-bold text-neutral-900 font-display tracking-tight mb-4"
          >
            How it works
          </h2>
          <p class="text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            Three steps to start receiving webhooks on your local machine. No
            port forwarding, no ngrok, no CLI &mdash; just a browser tab.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Step 1 -->
          <div class="card-surface p-8 text-center relative">
            <div
              class="step-number"
              style="
                background-color: var(--hs-brand-subtle);
                color: var(--hs-brand);
              "
            >
              1
            </div>
            <div
              class="w-12 h-12 rounded-xl mx-auto mb-5 flex items-center justify-center"
              style="background-color: var(--hs-brand-subtle)"
            >
              <i class="pi pi-link text-xl" style="color: var(--hs-brand)" />
            </div>
            <h3 class="text-lg font-semibold text-neutral-900 mb-2">
              Create an endpoint
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              Get a unique public URL like
              <code
                class="font-code text-xs px-1.5 py-0.5 rounded"
                style="
                  background-color: var(--hs-brand-subtle);
                  color: var(--hs-brand);
                "
                >hookspy.dev/hook/a1b2c3d4</code
              >
              that you can paste into any webhook provider.
            </p>
          </div>

          <!-- Step 2 -->
          <div class="card-surface p-8 text-center relative">
            <div
              class="step-number"
              style="
                background-color: var(--hs-brand-subtle);
                color: var(--hs-brand);
              "
            >
              2
            </div>
            <div
              class="w-12 h-12 rounded-xl mx-auto mb-5 flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-blue)"
            >
              <i class="pi pi-desktop text-xl" style="color: var(--hs-info)" />
            </div>
            <h3 class="text-lg font-semibold text-neutral-900 mb-2">
              Keep the dashboard open
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              Your browser acts as the relay bridge. Incoming webhooks appear in
              real time and are automatically forwarded to your local server.
            </p>
          </div>

          <!-- Step 3 -->
          <div class="card-surface p-8 text-center relative">
            <div
              class="step-number"
              style="
                background-color: var(--hs-brand-subtle);
                color: var(--hs-brand);
              "
            >
              3
            </div>
            <div
              class="w-12 h-12 rounded-xl mx-auto mb-5 flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-green)"
            >
              <i
                class="pi pi-replay text-xl"
                style="color: var(--hs-success)"
              />
            </div>
            <h3 class="text-lg font-semibold text-neutral-900 mb-2">
              Response flows back
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              Your local server's response is captured and returned to the
              original webhook sender &mdash; as if it hit your server directly.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- FEATURES -->
    <!-- ============================== -->
    <section
      id="features"
      class="py-20 sm:py-24"
      style="background-color: var(--hs-bg-page)"
    >
      <div class="landing-container">
        <div class="text-center mb-14">
          <h2
            class="text-3xl sm:text-4xl font-bold text-neutral-900 font-display tracking-tight mb-4"
          >
            Built for developer productivity
          </h2>
          <p class="text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            Everything you need to debug, test, and develop webhook integrations
            without deploying to a server.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div class="card-surface p-6">
            <div
              class="w-10 h-10 rounded-lg mb-4 flex items-center justify-center"
              style="background-color: var(--hs-brand-subtle)"
            >
              <i class="pi pi-bolt text-lg" style="color: var(--hs-brand)" />
            </div>
            <h3 class="text-base font-semibold text-neutral-900 mb-1.5">
              Real-time relay
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              Webhooks hit your local server the instant they arrive. Powered by
              Supabase Realtime for sub-second delivery.
            </p>
          </div>

          <div class="card-surface p-6">
            <div
              class="w-10 h-10 rounded-lg mb-4 flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-blue)"
            >
              <i class="pi pi-eye text-lg" style="color: var(--hs-info)" />
            </div>
            <h3 class="text-base font-semibold text-neutral-900 mb-1.5">
              Full request inspection
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              See headers, body, method, and status codes for every incoming
              webhook and every outgoing response.
            </p>
          </div>

          <div class="card-surface p-6">
            <div
              class="w-10 h-10 rounded-lg mb-4 flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-purple)"
            >
              <i class="pi pi-replay text-lg" style="color: #7c3aed" />
            </div>
            <h3 class="text-base font-semibold text-neutral-900 mb-1.5">
              One-click replay
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              Re-send any past webhook to your local server with one click.
              Perfect for reproducing bugs or testing edge cases.
            </p>
          </div>

          <div class="card-surface p-6">
            <div
              class="w-10 h-10 rounded-lg mb-4 flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-amber)"
            >
              <i class="pi pi-cog text-lg" style="color: var(--hs-warning)" />
            </div>
            <h3 class="text-base font-semibold text-neutral-900 mb-1.5">
              Custom header injection
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              Add extra headers to forwarded requests &mdash; great for passing
              auth tokens or debug flags to your local server.
            </p>
          </div>

          <div class="card-surface p-6">
            <div
              class="w-10 h-10 rounded-lg mb-4 flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-green)"
            >
              <i
                class="pi pi-shield text-lg"
                style="color: var(--hs-success)"
              />
            </div>
            <h3 class="text-base font-semibold text-neutral-900 mb-1.5">
              Secure by default
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              All traffic is SSL-encrypted end to end. Endpoints are isolated
              per user with row-level security. We never log or sell your
              payload data.
            </p>
          </div>

          <div class="card-surface p-6">
            <div
              class="w-10 h-10 rounded-lg mb-4 flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-red)"
            >
              <i
                class="pi pi-download text-lg"
                style="color: var(--hs-error)"
              />
            </div>
            <h3 class="text-base font-semibold text-neutral-900 mb-1.5">
              Zero install
            </h3>
            <p class="text-sm text-neutral-500 leading-relaxed">
              No CLI, no daemon, no Docker. Just open the dashboard in your
              browser and start receiving webhooks instantly.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- USE CASES -->
    <!-- ============================== -->
    <section class="py-20 sm:py-24">
      <div class="landing-container">
        <div class="text-center mb-14">
          <h2
            class="text-3xl sm:text-4xl font-bold text-neutral-900 font-display tracking-tight mb-4"
          >
            Perfect for any webhook workflow
          </h2>
          <p class="text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            Whether you're integrating Stripe, GitHub, or your own microservices
            &mdash; HookSpy makes local development seamless.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div class="card-surface p-6 flex gap-4 items-start">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style="background-color: var(--hs-brand-subtle)"
            >
              <i
                class="pi pi-credit-card text-lg"
                style="color: var(--hs-brand)"
              />
            </div>
            <div>
              <h3 class="text-base font-semibold text-neutral-900 mb-1">
                Payment webhooks
              </h3>
              <p class="text-sm text-neutral-500 leading-relaxed">
                Test Stripe, PayPal, or LemonSqueezy payment events locally
                without exposing your machine to the internet.
              </p>
            </div>
          </div>

          <div class="card-surface p-6 flex gap-4 items-start">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-blue)"
            >
              <i class="pi pi-github text-lg" style="color: var(--hs-info)" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-neutral-900 mb-1">
                CI/CD events
              </h3>
              <p class="text-sm text-neutral-500 leading-relaxed">
                Receive GitHub, GitLab, or Bitbucket webhook events on your
                local machine for integration testing.
              </p>
            </div>
          </div>

          <div class="card-surface p-6 flex gap-4 items-start">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-purple)"
            >
              <i class="pi pi-comments text-lg" style="color: #7c3aed" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-neutral-900 mb-1">
                Chat & messaging
              </h3>
              <p class="text-sm text-neutral-500 leading-relaxed">
                Develop Slack bots, Discord integrations, or Twilio flows with
                real webhook payloads hitting localhost.
              </p>
            </div>
          </div>

          <div class="card-surface p-6 flex gap-4 items-start">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style="background-color: var(--hs-icon-bg-amber)"
            >
              <i
                class="pi pi-server text-lg"
                style="color: var(--hs-warning)"
              />
            </div>
            <div>
              <h3 class="text-base font-semibold text-neutral-900 mb-1">
                Microservice events
              </h3>
              <p class="text-sm text-neutral-500 leading-relaxed">
                Route internal service-to-service webhooks to your local
                environment for end-to-end debugging.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- PRICING -->
    <!-- ============================== -->
    <section
      id="pricing"
      class="py-20 sm:py-24"
      style="background-color: var(--hs-bg-page)"
    >
      <div class="landing-container">
        <div class="text-center mb-14">
          <h2
            class="text-3xl sm:text-4xl font-bold text-neutral-900 font-display tracking-tight mb-4"
          >
            Simple, transparent pricing
          </h2>
          <p class="text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            HookSpy is free while in beta. We're focused on building the best
            webhook development experience before introducing paid plans.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <!-- Free plan -->
          <div
            class="card-surface p-8 relative"
            style="border-color: var(--hs-brand)"
          >
            <div
              class="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-xs font-semibold text-white"
              style="background-color: var(--hs-brand)"
            >
              Current
            </div>
            <h3 class="text-lg font-semibold text-neutral-900 mb-1">Beta</h3>
            <div class="flex items-baseline gap-1 mb-4">
              <span class="text-4xl font-bold text-neutral-900 font-display"
                >Free</span
              >
            </div>
            <p class="text-sm text-neutral-500 mb-6">
              Full access to all features while we're in beta.
            </p>
            <ul class="flex flex-col gap-3 mb-8">
              <li class="flex items-center gap-2.5 text-sm text-neutral-700">
                <i
                  class="pi pi-check text-xs"
                  style="color: var(--hs-success)"
                />
                Unlimited endpoints
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-700">
                <i
                  class="pi pi-check text-xs"
                  style="color: var(--hs-success)"
                />
                Real-time relay
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-700">
                <i
                  class="pi pi-check text-xs"
                  style="color: var(--hs-success)"
                />
                Request inspection & replay
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-700">
                <i
                  class="pi pi-check text-xs"
                  style="color: var(--hs-success)"
                />
                Custom header injection
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-700">
                <i
                  class="pi pi-check text-xs"
                  style="color: var(--hs-success)"
                />
                24-hour log retention
              </li>
            </ul>
            <p class="text-xs text-neutral-400 mb-6 -mt-4">
              Requests are stored for 24 hours and then permanently deleted.
            </p>
            <button
              class="btn-brand w-full py-3"
              @click="router.push({ name: 'register' })"
            >
              Get started free
            </button>
          </div>

          <!-- Pro plan (coming soon) -->
          <div class="card-surface p-8 opacity-80">
            <h3 class="text-lg font-semibold text-neutral-900 mb-1">Pro</h3>
            <div class="flex items-baseline gap-1 mb-4">
              <span class="text-4xl font-bold text-neutral-300 font-display"
                >TBD</span
              >
            </div>
            <p class="text-sm text-neutral-500 mb-6">
              Coming soon &mdash; longer retention, team features, and more.
            </p>
            <ul class="flex flex-col gap-3 mb-8">
              <li class="flex items-center gap-2.5 text-sm text-neutral-400">
                <i class="pi pi-check text-xs text-neutral-300" />
                Everything in Beta
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-400">
                <i class="pi pi-check text-xs text-neutral-300" />
                Extended log retention
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-400">
                <i class="pi pi-check text-xs text-neutral-300" />
                Team collaboration
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-400">
                <i class="pi pi-check text-xs text-neutral-300" />
                Webhook transformations
              </li>
              <li class="flex items-center gap-2.5 text-sm text-neutral-400">
                <i class="pi pi-check text-xs text-neutral-300" />
                Priority support
              </li>
            </ul>
            <button
              class="w-full py-3 rounded-lg text-sm font-semibold border border-neutral-200 text-neutral-400 cursor-not-allowed"
              disabled
            >
              Coming soon
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- FINAL CTA -->
    <!-- ============================== -->
    <section class="py-20 sm:py-24">
      <div class="landing-container text-center">
        <h2
          class="text-3xl sm:text-4xl font-bold text-neutral-900 font-display tracking-tight mb-4"
        >
          Start testing webhooks in seconds
        </h2>
        <p class="text-neutral-500 max-w-xl mx-auto leading-relaxed mb-8">
          Create a free account, set up an endpoint, and get a public URL you
          can use anywhere &mdash; all in under a minute.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            class="btn-brand text-base px-8 py-3.5"
            @click="router.push({ name: 'register' })"
          >
            Create free account
            <i class="pi pi-arrow-right text-sm" />
          </button>
          <router-link
            to="/login"
            class="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg text-base font-semibold text-neutral-700 no-underline transition-all duration-200 hover:text-neutral-900"
          >
            Sign in
            <i class="pi pi-sign-in text-sm" />
          </router-link>
        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- FOOTER -->
    <!-- ============================== -->
    <footer class="py-10 border-t" style="border-color: var(--hs-border)">
      <div class="landing-container">
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
              style="background-color: var(--hs-brand)"
            >
              H
            </div>
            <span class="text-sm font-semibold text-neutral-600 font-display"
              >HookSpy</span
            >
          </div>
          <p class="text-xs text-neutral-400">
            &copy; {{ currentYear }} HookSpy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing-page {
  background-color: var(--hs-bg-surface);
}

.landing-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background-color: color-mix(in srgb, var(--hs-bg-surface) 90%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--hs-border);
}

.landing-container {
  max-width: 72rem;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.landing-hero {
  padding-top: 5rem;
  padding-bottom: 5rem;
  background:
    url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='%23d4d4d4' fill-opacity='0.3'/%3E%3C/svg%3E"),
    linear-gradient(170deg, #f0fdfa 0%, #ffffff 40%, #ffffff 60%, #eff6ff 100%);
}

:global(.dark-mode) .landing-hero {
  background:
    url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='%23525252' fill-opacity='0.3'/%3E%3C/svg%3E"),
    linear-gradient(170deg, #0a2420 0%, #0a0a0a 40%, #0a0a0a 60%, #0c1525 100%);
}

@media (min-width: 640px) {
  .landing-hero {
    padding-top: 6rem;
    padding-bottom: 6rem;
  }
}

.step-number {
  position: absolute;
  top: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

/* Auth card styles */
.auth-card {
  border-radius: 1rem;
}

.auth-card-header {
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, var(--hs-brand) 0%, #0f766e 100%);
}

:global(.dark-mode) .auth-card-header {
  background: linear-gradient(135deg, #0f766e 0%, #134e4a 100%);
}

.auth-toggle-active {
  background-color: var(--hs-brand);
}
</style>

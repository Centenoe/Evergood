import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { withClerkHandler } from 'svelte-clerk/server'
import { redirect } from '@sveltejs/kit'

const PUBLIC_PATHS = ['/sign-in', '/sign-up']

const protectRoutes: Handle = async ({ event, resolve }) => {
    const path = event.url.pathname
    const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p))

    if (!isPublicPath) {
        const auth = event.locals.auth()
        if (!auth.userId) {
            redirect(303, '/sign-in')
        }
    }

    return resolve(event)
}

const addNoCacheHeaders: Handle = async ({ event, resolve }) => {
    const response = await resolve(event)
    const path = event.url.pathname
    const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p))

    if (!isPublicPath) {
        response.headers.set(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate'
        )
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
    }

    return response
}

export const handle: Handle = sequence(
    withClerkHandler(),
    protectRoutes,
    addNoCacheHeaders
)

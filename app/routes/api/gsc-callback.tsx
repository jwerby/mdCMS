import { createFileRoute, redirect } from '@tanstack/react-router'

// This route is no longer needed since we use service account auth
// Redirect to settings if anyone lands here
export const Route = createFileRoute('/api/gsc-callback')({
  loader: async () => {
    throw redirect({
      to: '/dashboard/seo-planner/settings'
    })
  },
  component: () => null
})

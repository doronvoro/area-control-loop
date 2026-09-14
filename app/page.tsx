import { redirect } from 'next/navigation';
import { getRequestScope, resolveCustomerId } from '@/lib/api/auth-context';
import { hasOliveAreas } from '@/lib/olive/has-olive-areas';
import { getLandingPath } from '@/lib/navigation';

/**
 * The one place that decides where a signed-in user with no page in mind ends
 * up. Login points here rather than at a route of its own so there is a single
 * answer; an olive tenant lands on the harvest module, everyone else on the
 * dashboard.
 *
 * Already dynamic — getRequestScope reads cookies() and headers().
 */
export default async function HomePage() {
  // Redirects to /login itself when there is no session.
  const scope = await getRequestScope();

  const olive = await hasOliveAreas(scope.supabase, scope.isAdmin, resolveCustomerId(scope));

  redirect(getLandingPath({ olive }));
}

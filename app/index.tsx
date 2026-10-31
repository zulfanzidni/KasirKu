import { Shell } from '@/screens/Shell';

/**
 * The app opens on the till. Everything else is a tab inside `Shell`, which
 * keeps one provider and one cart across navigation.
 */
export default function Index() {
  return <Shell />;
}

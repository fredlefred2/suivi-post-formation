import { redirect } from 'next/navigation'

// Route dépréciée — redirige vers la nouvelle page d'accueil
export default function GroupsPage() {
  redirect('/trainer/dashboard')
}

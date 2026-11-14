import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

const ONGLETS = [
  { to: '/', label: 'Voitures', icone: '🚗' },
  { to: '/box', label: 'Box pneus', icone: '🛞' },
  { to: '/garages', label: 'Garages', icone: '🔧' },
  { to: '/reglages', label: 'Réglages', icone: '⚙️' },
]

export default function Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const masquerPlus = pathname.startsWith('/ajout') || pathname.startsWith('/papier') || pathname.endsWith('/modifier') || pathname.endsWith('/nouvelle')
  const idVoiture = pathname.match(/^\/voiture\/([0-9a-f-]{36})$/)?.[1]

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-28">
      <header className="sticky top-0 z-10 bg-slate-900 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
        <h1 className="text-lg font-semibold">Carnet auto famille</h1>
      </header>
      <main className="p-4">
        <Outlet />
      </main>

      {!masquerPlus && (
        <button
          aria-label="Ajouter une intervention"
          onClick={() => navigate(idVoiture ? `/ajout?voiture=${idVoiture}` : '/ajout')}
          className="fixed bottom-24 right-4 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 text-4xl leading-none text-white shadow-lg active:bg-sky-600 sm:right-[calc(50%-17rem)]"
        >
          +
        </button>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-xl">
          {ONGLETS.map((o) => (
            <NavLink
              key={o.to}
              to={o.to}
              end={o.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center pt-2 text-xs ${isActive ? 'font-semibold text-slate-900' : 'text-slate-500'}`
              }
            >
              <span className="text-xl">{o.icone}</span>
              {o.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

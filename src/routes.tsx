import { createBrowserRouter, Navigate } from 'react-router'
import { useEffect } from 'react'
import EnvCheckPage from './pages/EnvCheckPage'
import AppLayout from './components/AppLayout'
import ChatView from './pages/ChatView'
import ChannelPanel from './pages/ChannelPanel'
import LogPanel from './pages/LogPanel'
import SettingsPage from './pages/SettingsPage'
import ConfigPage from './pages/ConfigPage'

function RootIndex() {
  const ready = sessionStorage.getItem('envReady') === 'true'

  useEffect(() => {
    window.location.href = '/env-check'
  }, [])

  if (ready) {
    return <Navigate to='/chat' replace />
  }

  return null
}

const router = createBrowserRouter([
  {
    path: '/env-check',
    element: <EnvCheckPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <RootIndex />,
      },
      {
        path: 'chat',
        element: <ChatView />,
      },
      {
        path: 'channels',
        element: <ChannelPanel />,
      },
      {
        path: 'logs',
        element: (
          <div style={{ padding: 16, height: '100%' }}>
            <LogPanel />
          </div>
        ),
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'config',
        element: <ConfigPage />,
      },
    ],
  },
])

export { router }

import { createBrowserRouter, Navigate } from 'react-router'
import { useEffect } from 'react'
import EnvCheck from './pages/EnvCheck'
import AppLayout from './components/AppLayout'
import ChatView from './pages/ChatView'
import Channel from './pages/Channel'
import Log from './pages/Log'
import Gateway from './pages/Gateway'
import Config from './pages/Config'

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
    element: <EnvCheck />,
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
        element: <Channel />,
      },
      {
        path: 'logs',
        element: (
          <div style={{ padding: 16, height: '100%' }}>
            <Log />
          </div>
        ),
      },
      {
        path: 'gateway',
        element: <Gateway />,
      },
      {
        path: 'config',
        element: <Config />,
      },
    ],
  },
])

export { router }

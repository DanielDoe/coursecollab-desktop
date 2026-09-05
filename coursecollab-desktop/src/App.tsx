import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

function App() {
  const [theme, setTheme] = useState<Theme>('system')
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.courseCollabDesktop.getAppVersion().then(setVersion)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <main className="shell">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-mark__column brand-mark__column--left" />
          <span className="brand-mark__column brand-mark__column--center" />
          <span className="brand-mark__column brand-mark__column--right" />
        </div>
        <p className="eyebrow">CourseCollab · Desktop</p>
        <h1 id="welcome-title">A calmer place to collaborate.</h1>
        <p className="message">Your CourseCollab workspace will appear here.</p>
        <div className="card-footer">
          <span>Foundation build{version ? ` · v${version}` : ''}</span>
          <label>
            <span className="sr-only">Theme</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              <option value="system">System theme</option>
              <option value="light">Light mode</option>
              <option value="dark">Dark mode</option>
            </select>
          </label>
        </div>
      </section>
    </main>
  )
}

export default App

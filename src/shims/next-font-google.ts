type FontResult = {
  className: string
  variable: string
  style: { fontFamily: string }
}

function createFontStub(variable: string, family: string): FontResult {
  return {
    className: '',
    variable,
    style: { fontFamily: family },
  }
}

export function Inter() {
  return createFontStub('--font-sans', 'Inter, ui-sans-serif, system-ui, sans-serif')
}

export function Roboto_Mono() {
  return createFontStub('--font-mono', 'Roboto Mono, ui-monospace, monospace')
}

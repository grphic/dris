import { useState } from 'react'
import { NS_LOGO_PATH, NS_LOGO_VIEWBOX } from './nsPath'

export function NsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={NS_LOGO_VIEWBOX} aria-label="NS">
      <path d={NS_LOGO_PATH} fill="currentColor" />
    </svg>
  )
}

const NS_OPERATORS = new Set(['NS', 'NS INT'])

/**
 * Logo for other operators: /dris/img/operators/<code>.svg (e.g. arr.svg, "blauwnet a" → blauwnet-a.svg).
 * Falls back to the operator name as text until a logo file is added.
 */
export function OperatorLogo({ code, name }: { code: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const file = code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  if (failed) return <span className="operator-text">{name}</span>
  return (
    <img
      className="operator-logo"
      src={`${import.meta.env.BASE_URL}img/operators/${file}.svg`}
      alt={name}
      onError={() => setFailed(true)}
    />
  )
}

export function Product({ longName, operatorCode, operatorName }: { longName: string; operatorCode: string; operatorName: string }) {
  const isNs = NS_OPERATORS.has(operatorCode.toUpperCase())
  return (
    <div className="product">
      <span className="product-name">{longName}</span>
      {isNs ? <NsLogo className="product-logo" /> : <OperatorLogo code={operatorCode} name={operatorName} />}
    </div>
  )
}

/** Overview rows: the logo with the product name below it. */
export function ProductStack({ longName, operatorCode, operatorName }: { longName: string; operatorCode: string; operatorName: string }) {
  const isNs = NS_OPERATORS.has(operatorCode.toUpperCase())
  return (
    <div className="product-stack">
      {isNs ? <NsLogo className="product-logo" /> : <OperatorLogo code={operatorCode} name={operatorName} />}
      <span className="product-name">{longName}</span>
    </div>
  )
}

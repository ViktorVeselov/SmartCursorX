type IconName = 'rules' | 'openclaw' | 'usage' | 'performance' | 'finetune' | 'general' | 'models' | 'local' | 'agent'

const PATHS: Record<IconName, string> = {
  rules: '<path d="M12.5 1H3v14h10V3.5L12.5 1ZM3 0h10l2 2v13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1Zm2 5h6v1H5V5Zm0 2h6v1H5V7Zm0 2h4v1H5V9Z"/>',
  openclaw: '<path d="M7 9.782a4.5 4.5 0 1 1 2 0V11H7V9.782ZM5.5 6.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0ZM13 15a5 5 0 0 0-10 0h1.5a3.5 3.5 0 0 1 7 0H13Z"/>',
  usage: '<path d="M2 11h2v4H2v-4Zm5-4h2v8H7V7Zm5-3h2v11h-2V4ZM2 13h2v2H2v-2Zm5-8h2v2H7V5Zm5-3h2v2h-2V2Z"/>',
  performance: '<path d="M8.5 1.5A.5.5 0 0 0 8 2v5.5L5.5 6 5 6.5 8 10V2a.5.5 0 0 0-.5-.5ZM8 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-2 3a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"/>',
  finetune: '<path d="M13.5 1a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5h11ZM3 8l2-3 1.5 2L9 4l2 4H3Zm9-5.5h-2v1h2v-1ZM3.5 10h9v4a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-4Z"/>',
  general: '<path d="M10.5 1a.5.5 0 0 1 .5.5V3h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V4H5.5a.5.5 0 0 1 0-1H10V1.5a.5.5 0 0 1 .5-.5ZM3 6h10v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm1 1v7h8V7H4Z"/>',
  models: '<path d="M8.5 1.5A.5.5 0 0 1 9 1h4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-1.42l-2.21 2.21a.5.5 0 0 1-.7 0L6.7 5.08a.5.5 0 0 1 0-.7l1.02-1.02A.5.5 0 0 1 7.5 3h.5V1.5ZM7.17 2.5a.5.5 0 0 1 .33.83L6 4.83l1.5 1.5 2.5-2.5V3H8.5a.5.5 0 0 1-.5-.5V2h-.83ZM4.02 6.56a.5.5 0 0 1 .7.7c-.3.3-.22.74.02.98l2.47 2.46c.24.24.68.32.98.02a.5.5 0 0 1 .7.7 1.96 1.96 0 0 1-2.68-.02L3.72 9.24a1.96 1.96 0 0 1 .3-2.68Z"/>',
  local: '<path d="M3.5 1A1.5 1.5 0 0 0 2 2.5v11A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 12.5 1h-9ZM3 2.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-11ZM5 6h6v1H5V6Zm0 2h6v1H5V8Zm0 2h4v1H5v-1Z"/>',
  agent: '<path d="M7 1.5a.5.5 0 0 0-1 0V4H2.5a.5.5 0 0 0 0 1H6v2.5a.5.5 0 0 0 1 0V5h3.5a.5.5 0 0 0 0-1H7V1.5ZM2 10a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4Z"/>',
}

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ verticalAlign: '-2px' }}
      className={className}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  )
}

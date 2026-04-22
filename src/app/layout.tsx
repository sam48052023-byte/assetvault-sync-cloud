export const metadata = {
  title: 'AssetVault Sync',
  description: 'Metadata sync backend for AssetVault',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

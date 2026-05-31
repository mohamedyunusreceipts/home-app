import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700">Home</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            Shared home management for couples. The app is being built.
          </p>
          <Button>Get started</Button>
          <Button variant="outline">Learn more</Button>
        </CardContent>
      </Card>
    </main>
  )
}

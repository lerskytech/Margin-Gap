import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'

const plans = [
  {
    name: 'Free',
    tier: 'free' as const,
    price: '$0',
    credits: 10,
    features: [
      '10 scans per month',
      'Basic price intelligence',
      'Watchlist (10 items)',
      'Email support',
    ],
  },
  {
    name: 'Basic',
    tier: 'basic' as const,
    price: '$9.99',
    credits: 50,
    features: [
      '50 scans per month',
      'Advanced price intelligence',
      'Watchlist (unlimited)',
      'Saved searches',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    tier: 'pro' as const,
    price: '$29.99',
    credits: 200,
    features: [
      '200 scans per month',
      'Premium price intelligence',
      'Watchlist (unlimited)',
      'Saved searches',
      'Price alerts',
      'Priority email support',
    ],
  },
  {
    name: 'Expert',
    tier: 'expert' as const,
    price: '$99.99',
    credits: 1000,
    features: [
      '1000 scans per month',
      'Enterprise price intelligence',
      'Watchlist (unlimited)',
      'Saved searches',
      'Price alerts',
      'API access',
      'Priority support',
    ],
  },
]

export function PricingPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Pricing Plans</h1>
        <p className="text-muted-foreground text-lg">
          Choose the plan that's right for you
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card key={plan.tier} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle>{plan.name}</CardTitle>
                {plan.tier === 'pro' && (
                  <Badge variant="warning">Popular</Badge>
                )}
              </div>
              <div className="text-3xl font-bold">{plan.price}</div>
              <div className="text-sm text-muted-foreground">
                {plan.credits} scans/month
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.tier === 'pro' ? 'primary' : 'outline'}
                className="w-full"
                disabled
              >
                {plan.tier === 'free' ? 'Current Plan' : 'Coming Soon'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>Payment integration coming soon. All plans include a free tier to get started.</p>
      </div>
    </div>
  )
}

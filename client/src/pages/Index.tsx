import { Link } from 'react-router-dom';
import { Container, Section } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Target,
  ArrowRight,
  Sparkles,
  BarChart3,
  Eye,
  Layers
} from 'lucide-react';

const features = [
  {
    icon: TrendingUp,
    title: 'Performance Analytics',
    description: 'Real-time insights into team performance and productivity metrics',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Enhanced tools for seamless team coordination and communication',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Target,
    title: 'Goal Tracking',
    description: 'Set, monitor, and achieve team objectives with precision',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: BarChart3,
    title: 'Advanced Reports',
    description: 'Comprehensive reporting with actionable insights and trends',
    color: 'from-orange-500 to-red-500'
  }
];

const implementations = [
  {
    href: '/original',
    icon: Activity,
    title: 'Original Implementation',
    description: 'Current responsive design with enhanced functionality',
    badge: 'Stable',
    badgeVariant: 'default' as const,
    features: ['Responsive Design', 'Core Analytics', 'Team Management']
  },
  {
    href: '/figma',
    icon: Layers,
    title: 'Figma Implementation', 
    description: 'Pixel-perfect recreation with modern design system',
    badge: 'Design Focus',
    badgeVariant: 'secondary' as const,
    features: ['Design System', 'Component Library', 'Visual Consistency']
  },
  {
    href: '/analysis',
    icon: TrendingUp,
    title: 'Analytics Dashboard',
    description: 'Advanced analytics and performance insights',
    badge: 'New',
    badgeVariant: 'destructive' as const,
    features: ['Real-time Data', 'Custom Reports', 'Performance Metrics']
  }
];

export default function Index() {
  return (
    <div className="bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <Section spacing="xl" className="relative overflow-hidden">
        <Container>
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                TeamTrack V2.0
              </Badge>
              
              <h1 className="heading-primary">
                Elevate Your Team's
                <span className="text-gradient block mt-2">
                  Performance Analytics
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Discover powerful insights, track performance metrics, and optimize your team's 
                productivity with our comprehensive analytics platform.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="btn-primary-modern group">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="btn-secondary-modern">
                <Eye className="w-4 h-4 mr-2" />
                View Demo
              </Button>
            </div>
          </div>
        </Container>

        {/* Decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-team-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-team-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </Section>

      {/* Features Section */}
      <Section spacing="lg" className="relative">
        <Container>
          <div className="text-center mb-16">
            <h2 className="heading-secondary mb-4">
              Powerful Features for Modern Teams
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to analyze, optimize, and scale your team's performance
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="card-modern group hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Implementations Section */}
      <Section spacing="xl">
        <Container>
          <div className="text-center mb-16">
            <h2 className="heading-secondary mb-4">
              Choose Your Experience
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Multiple implementations tailored for different use cases and preferences
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {implementations.map((impl) => (
              <Card key={impl.title} className="card-interactive group">
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <impl.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <Badge variant={impl.badgeVariant}>
                      {impl.badge}
                    </Badge>
                  </div>
                  
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {impl.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {impl.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3 mb-6">
                    {impl.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  
                  <Button asChild className="w-full group/btn">
                    <Link to={impl.href}>
                      Explore
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <Container>
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2025 TeamTrack. Built with modern web technologies.</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}

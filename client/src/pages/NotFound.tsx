import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout, Container, Section } from '@/components/Layout';
import { ModernHeader } from '@/components/ModernHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  ArrowLeft, 
  Search, 
  HelpCircle,
  Compass
} from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Log 404 error for debugging
    console.warn(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <Layout background="gradient">
      <ModernHeader showNavigation={false} />
      
      <Section spacing="xl" className="flex-1 flex items-center">
        <Container className="text-center">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* 404 Display */}
            <div className="space-y-4">
              <Badge variant="destructive" className="mb-4">
                <HelpCircle className="w-3 h-3 mr-1" />
                Error 404
              </Badge>
              
              <div className="relative">
                <h1 className="text-8xl md:text-9xl font-black text-gradient opacity-20 select-none">
                  404
                </h1>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Compass className="w-24 h-24 text-muted-foreground animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold">
                  Page Not Found
                </h2>
                <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Oops! The page you're looking for seems to have wandered off. 
                  Let's get you back on track.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="btn-primary-modern group" asChild>
                <Link to="/">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Link>
              </Button>
              
              <Button variant="outline" size="lg" className="btn-secondary-modern group" asChild>
                <Link to="/sessions">
                  <Search className="w-4 h-4 mr-2" />
                  Browse Sessions
                </Link>
              </Button>
            </div>

            {/* Help Links */}
            <div className="pt-8 border-t border-border/50">
              <p className="text-sm text-muted-foreground mb-4">
                Still having trouble? Try these helpful links:
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link
                  to="/analysis"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Analytics Dashboard
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link
                  to="/figma"
                  className="text-primary hover:underline"
                >
                  Design System
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link
                  to="/profile"
                  className="text-primary hover:underline"
                >
                  My Profile
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link
                  to="/help"
                  className="text-primary hover:underline"
                >
                  Get Help
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </Layout>
  );
};

export default NotFound;

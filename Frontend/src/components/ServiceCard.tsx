
import { LucideIcon } from 'lucide-react';

interface ServiceCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const ServiceCard = ({ title, description, icon: Icon }: ServiceCardProps) => {
  return (
    <div className="p-6 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-md bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-secondary">{description}</p>
        </div>
      </div>
    </div>
  );
};

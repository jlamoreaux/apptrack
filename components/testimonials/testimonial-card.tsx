import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";

interface TestimonialCardProps {
  name: string;
  role: string;
  company?: string;
  content: string;
  rating?: number;
  avatarUrl?: string;
  highlight?: string;
}

export function TestimonialCard({
  name,
  role,
  company,
  content,
  rating = 5,
  avatarUrl,
  highlight,
}: TestimonialCardProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="h-full hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6 flex flex-col h-full">
        {/* Rating Stars */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-gray-200 text-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Testimonial Content */}
        <div className="flex-1">
          {highlight && (
            <p className="font-semibold text-lg mb-2 text-primary">"{highlight}"</p>
          )}
          {content && (
            <p className="text-muted-foreground leading-relaxed">{content}</p>
          )}
        </div>

        {/* Author Info */}
        <div className="flex items-center gap-3 mt-6">
          <Avatar className="h-10 w-10">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">
              {role}
              {company && ` at ${company}`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import { Check } from "lucide-react"

interface CheckListItem {
  text: string
}

interface CheckListProps {
  items: CheckListItem[] | string[]
  className?: string
}

export function CheckList({ items, className = "" }: CheckListProps) {
  const normalizedItems = items.map(item => 
    typeof item === 'string' ? { text: item } : item
  )

  return (
    <ul className={`space-y-2 ${className}`}>
      {normalizedItems.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  )
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EconomicDeclaration } from "@/types"

interface Props {
  declaration: EconomicDeclaration
}

export function EconomicDeclarationView({ declaration }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Declaración de bienes
          {declaration.declaration_date && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {new Date(declaration.declaration_date).toLocaleDateString("es-ES")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-96">
          {JSON.stringify(declaration.raw_data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

import Image from "next/image"

export function LogoHero() {
  return (
    <div className="flex flex-col items-center gap-4 pt-4">
      <Image
        src="/logo.svg"
        alt="Acción Humana"
        width={80}
        height={80}
        className="dark:invert"
        priority
      />
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Acción Humana</h1>
        <p className="text-muted-foreground text-lg max-w-lg">
          &ldquo;El Estado no existe fuera de las personas que lo conforman.&rdquo;
        </p>
      </div>
    </div>
  )
}

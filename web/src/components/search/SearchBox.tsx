"use client"

import { SearchForm } from "@/components/search/SearchForm"

export function SearchBox() {
  return (
    <div className="mx-auto max-w-xl">
      <SearchForm size="hero" live />
    </div>
  )
}

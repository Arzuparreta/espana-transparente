"use client"

import { SearchForm } from "@/components/search/SearchForm"

export function SearchBox() {
  return (
    <div className="max-w-xl">
      <SearchForm size="hero" live />
    </div>
  )
}

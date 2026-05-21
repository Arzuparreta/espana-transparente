"use client"

import { SearchForm } from "@/components/search/SearchForm"

export function SearchBox() {
  return (
    <div className="w-full">
      <SearchForm size="hero" live />
    </div>
  )
}

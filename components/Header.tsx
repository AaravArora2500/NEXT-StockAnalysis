"use client"

import Link from "next/link"
import React, { useState } from "react"
import { Button } from "./ui/button"
import { Menu, X, LogIn, UserPlus, BarChart3 } from "lucide-react"

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-screen border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/60">
      <div className="w-full px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="p-2.5 bg-gradient-to-br from-emerald-400 via-cyan-400 to-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all duration-300">
              <BarChart3 className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-500 bg-clip-text text-transparent">
                MarketVista
              </h1>
              <p className="text-xs text-slate-500 font-medium">Stock Intelligence</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-sm text-slate-400 hover:text-emerald-400 transition-colors duration-200 font-medium"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-slate-400 hover:text-emerald-400 transition-colors duration-200 font-medium"
            >
              Pricing
            </Link>
            <Link
              href="#faq"
              className="text-sm text-slate-400 hover:text-emerald-400 transition-colors duration-200 font-medium"
            >
              FAQ
            </Link>
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            <Button
              variant="ghost"
              asChild
              className="flex items-center space-x-2 text-slate-300 hover:text-white hover:bg-slate-800/50"
            >
              <Link href="/login">
                <LogIn className="w-4 h-4" />
                <span>Log in</span>
              </Link>
            </Button>
            <Button
              asChild
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-105"
            >
              <Link href="/signup">
                <UserPlus className="w-4 h-4" />
                <span>Sign up</span>
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-slate-300" />
            ) : (
              <Menu className="w-6 h-6 text-slate-300" />
            )}
            <span className="sr-only">Toggle Menu</span>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
            <nav className="flex flex-col space-y-1 py-4">
              <Link
                href="#features"
                className="px-4 py-2.5 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="px-4 py-2.5 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className="px-4 py-2.5 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                FAQ
              </Link>
              <div className="border-t border-slate-800/50 pt-4 mt-4 flex flex-col space-y-2">
                <Button
                  variant="ghost"
                  asChild
                  className="flex items-center justify-center space-x-2 text-slate-300 hover:text-white hover:bg-slate-800/50"
                >
                  <Link href="/login">
                    <LogIn className="w-4 h-4" />
                    <span>Log in</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
                >
                  <Link href="/signup">
                    <UserPlus className="w-4 h-4" />
                    <span>Sign up</span>
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
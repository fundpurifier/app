"use client"

import { Disclosure } from "@headlessui/react"
import { Bars3Icon, BellIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { UserButton } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { getMarketStatus, MarketStatus } from "./actions"
import { timeFromNow } from "@/helpers"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const path = usePathname()
  const [marketStatus, setMarketStatus] = React.useState<MarketStatus | null>(
    null
  )

  const navigation = [
    { name: "Home", href: "/", current: path === "/" },
    { name: "Settings", href: "/settings", current: path === "/settings" },
    {
      name: "Transfers ↗",
      href: "https://app.alpaca.markets/brokerage/banking?transfer=deposit",
      current: false,
      external: true,
    },
  ]

  React.useEffect(() => {
    // Fetch the market status
    ;(async () => {
      const market = await getMarketStatus()
      setMarketStatus(market)
    })()
  }, [])

  function MarketStatus({ details }: { details?: boolean }) {
    const [countdown, setCountdown] = React.useState("")
    const [marketStatus, setMarketStatus] = React.useState<MarketStatus | null>(
      null
    )

    const fetchMarketStatus = async () => {
      const market = await getMarketStatus()
      setMarketStatus(market)
    }

    React.useEffect(() => {
      fetchMarketStatus()
    }, [])

    React.useEffect(() => {
      if (marketStatus === null) return () => {}
      const { isOpen, nextCloseInSeconds, nextOpenInSeconds } = marketStatus

      // Calculate the target time (in milliseconds)
      const targetTime =
        Date.now() + (isOpen ? nextCloseInSeconds : nextOpenInSeconds) * 1000

      // Update the countdown every second
      const intervalId = setInterval(() => {
        const remainingSeconds = Math.max(
          0,
          Math.floor((targetTime - Date.now()) / 1000)
        )
        const countdownValue = timeFromNow(remainingSeconds)
        setCountdown(countdownValue)

        // If countdown reaches zero, refetch the market status
        if (remainingSeconds === 0) {
          fetchMarketStatus()
        }
      }, 1000)

      // Clear interval on component unmount
      return () => clearInterval(intervalId)
    }, [marketStatus])

    if (marketStatus === null) return null

    const { isOpen } = marketStatus

    return (
      <div className={cn("flex flex-row items-center", details ? "mr-4" : "")}>
        <div
          className={cn(
            "flex flex-row gap-x-1 items-center mx-2 rounded-full px-3 py-1.5 text-sm uppercase font-medium",
            isOpen ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}
        >
          <svg
            className="w-4 h-4 text-current"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="6" stroke="none" strokeWidth="0" />
            <circle cx="12" cy="12" r="6" stroke="none" strokeWidth="0">
              <animate
                attributeName="fill"
                values={isOpen ? "lightgreen;darkgreen;lightgreen" : "darkred"}
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
          <span>Market {isOpen ? "Open" : "Closed"}</span>
        </div>

        {details &&
          (!isOpen ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <span>Opens in {countdown}</span>
            </div>
          ) : (
            <div className="flex items-center text-sm text-muted-foreground">
              <span>Closes in {countdown}</span>
            </div>
          ))}
      </div>
    )
  }

  return (
    <>
      <div className="min-h-full border-t-4 border-t-violet-600">
        <Disclosure as="nav" className="bg-white border-b border-gray-200">
          {({ open }) => (
            <>
              <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex">
                    <div className="flex items-center flex-shrink-0">
                      <Link href="/">
                        <Image
                          src="/amal.svg"
                          alt="Amal Invest"
                          height={28}
                          width={60}
                        />
                      </Link>
                    </div>
                    <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                      {navigation.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            item.current
                              ? "border-indigo-500 text-gray-900"
                              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                            "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium"
                          )}
                          aria-current={item.current ? "page" : undefined}
                          target={item.external ? "_blank" : undefined}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:items-center">
                    {/* Profile dropdown */}
                    <MarketStatus details={true} />
                    <UserButton />
                  </div>
                  <div className="flex items-center -mr-2 sm:hidden">
                    {/* Mobile menu button */}
                    <Disclosure.Button className="relative inline-flex items-center justify-center p-2 text-gray-400 bg-white rounded-md hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                      <span className="absolute -inset-0.5" />
                      <span className="sr-only">Open main menu</span>
                      {open ? (
                        <XMarkIcon
                          className="block w-6 h-6"
                          aria-hidden="true"
                        />
                      ) : (
                        <Bars3Icon
                          className="block w-6 h-6"
                          aria-hidden="true"
                        />
                      )}
                    </Disclosure.Button>
                  </div>
                </div>
              </div>

              <Disclosure.Panel className="sm:hidden">
                <div className="pt-2 pb-3 space-y-1">
                  {navigation.map((item) => (
                    <Disclosure.Button
                      key={item.name}
                      as={Link}
                      href={item.href}
                      className={cn(
                        item.current
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
                        "block border-l-4 py-2 pl-3 pr-4 text-base font-medium"
                      )}
                      aria-current={item.current ? "page" : undefined}
                      target={item.external ? "_blank" : undefined}
                    >
                      {item.name}
                    </Disclosure.Button>
                  ))}
                </div>
                <div className="flex flex-row justify-between px-4 pt-4 pb-3 border-t border-gray-200">
                  <UserButton />
                  <MarketStatus details={false} />
                </div>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>

        <div className="py-10">
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </>
  )
}

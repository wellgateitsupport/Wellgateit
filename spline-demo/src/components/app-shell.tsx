import * as React from "react"
import {
  BarChart3,
  Bell,
  Calendar,
  CheckSquare,
  ChevronDown,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  MoreVertical,
  Package,
  ScrollText,
  Search,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

const AVATAR_URL =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces"

interface NavItem {
  label: string
  icon: LucideIcon
  active?: boolean
  badge?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: "ภาพรวม",
    items: [
      { label: "แดชบอร์ด", icon: LayoutDashboard, active: true },
      { label: "กล่องงาน", icon: Inbox, badge: "5" },
      { label: "ข้อมูลเชิงลึก", icon: TrendingUp },
    ],
  },
  {
    title: "งานของฉัน",
    items: [
      { label: "คำขอที่ส่ง", icon: FileText },
      { label: "รออนุมัติ", icon: CheckSquare, badge: "3" },
      { label: "ปฏิทิน", icon: Calendar },
    ],
  },
]

const reportItems: NavItem[] = [
  { label: "รายงานผู้บริหาร", icon: BarChart3 },
  { label: "สต๊อก", icon: Package },
  { label: "บันทึกกิจกรรม", icon: ScrollText },
]

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <a
      href="#"
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        item.active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
          {item.badge}
        </span>
      ) : null}
    </a>
  )
}

function UserMenuItems() {
  return (
    <>
      <DropdownMenuLabel>
        <div className="flex flex-col">
          <span className="text-sm font-medium">สมหญิง รักงาน</span>
          <span className="text-xs font-normal text-muted-foreground">
            ผู้ดูแลระบบ
          </span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>โปรไฟล์</DropdownMenuItem>
      <DropdownMenuItem>ตั้งค่า</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive focus:text-destructive">
        ออกจากระบบ
      </DropdownMenuItem>
    </>
  )
}

function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-background lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          FD
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">
            FlowDesk
          </div>
          <div className="truncate text-xs text-muted-foreground">
            ระบบแจ้งงานและติดตามงาน
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink key={item.label} item={item} />
              ))}
            </div>
          </div>
        ))}

        {/* รายงาน (collapsible) */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="group mb-2 flex w-full items-center justify-between px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
            <span>รายงาน</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1">
              {reportItems.map((item) => (
                <NavLink key={item.label} item={item} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </nav>

      {/* User card */}
      <div className="mt-auto">
        <Separator />
        <div className="flex items-center gap-3 p-4">
          <Avatar>
            <AvatarImage src={AVATAR_URL} alt="สมหญิง รักงาน" />
            <AvatarFallback>สม</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">สมหญิง รักงาน</p>
            <p className="truncate text-xs text-muted-foreground">
              ผู้ดูแลระบบ
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">เมนูผู้ใช้</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
              <UserMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}

function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">เปิดเมนู</span>
      </Button>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="ค้นหาคำขอ, ผู้ขอ, ID..."
          className="pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          <span className="sr-only">การแจ้งเตือน</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={AVATAR_URL} alt="สมหญิง รักงาน" />
                <AvatarFallback>สม</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <UserMenuItems />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto bg-muted/40 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppShell

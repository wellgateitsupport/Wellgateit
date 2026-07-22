import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Plus,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

// ---------- mock data ----------

type Stat = {
  title: string
  value: string
  delta: string
  deltaClass: string
  suffix?: string
  icon: LucideIcon
}

const stats: Stat[] = [
  {
    title: 'คำขอทั้งหมดเดือนนี้',
    value: '128',
    delta: '+12.5%',
    deltaClass: 'text-emerald-600',
    suffix: ' จากเดือนก่อน',
    icon: FileText,
  },
  {
    title: 'รออนุมัติ',
    value: '23',
    delta: 'เกิน SLA 4 รายการ',
    deltaClass: 'text-destructive',
    icon: Clock,
  },
  {
    title: 'อนุมัติแล้ว',
    value: '96',
    delta: '+8.1%',
    deltaClass: 'text-emerald-600',
    suffix: ' จากเดือนก่อน',
    icon: CheckCircle2,
  },
  {
    title: 'มูลค่ารวม',
    value: '฿1.24M',
    delta: '+21.3%',
    deltaClass: 'text-emerald-600',
    suffix: ' จากเดือนก่อน',
    icon: Wallet,
  },
]

type TrendPoint = { month: string; submitted: number; approved: number }

const trendData: TrendPoint[] = [
  { month: 'ก.พ.', submitted: 62, approved: 48 },
  { month: 'มี.ค.', submitted: 74, approved: 61 },
  { month: 'เม.ย.', submitted: 68, approved: 55 },
  { month: 'พ.ค.', submitted: 86, approved: 70 },
  { month: 'มิ.ย.', submitted: 105, approved: 84 },
  { month: 'ก.ค.', submitted: 128, approved: 96 },
]

type TypeCount = { name: string; count: number }

const typeData: TypeCount[] = [
  { name: 'เบิกของ', count: 34 },
  { name: 'เบิกเงิน', count: 28 },
  { name: 'จัดซื้อ', count: 22 },
  { name: 'อีเว้นท์', count: 16 },
  { name: 'OT', count: 15 },
  { name: 'ใบลา', count: 13 },
]

type RequestStatus = 'อนุมัติแล้ว' | 'รออนุมัติ' | 'ตีกลับ' | 'กำลังดำเนินการ'

type RequestRow = {
  id: string
  subject: string
  requester: string
  avatar: string
  initial: string
  type: string
  status: RequestStatus
  amount: string
  sla: string
  slaOverdue?: boolean
}

const avatarUrl = (id: string) =>
  `https://images.unsplash.com/${id}?w=64&h=64&fit=crop&crop=faces`

const requests: RequestRow[] = [
  {
    id: 'WR-26-0341',
    subject: 'เบิกของแถมโปรโมชั่น Q3',
    requester: 'สมชาย ใจดี',
    avatar: avatarUrl('photo-1472099645785-5658abf4ff4e'),
    initial: 'ส',
    type: 'เบิกของ',
    status: 'รออนุมัติ',
    amount: '฿12,500',
    sla: 'อีก 2 วัน',
  },
  {
    id: 'EX-26-0198',
    subject: 'เบิกค่าเดินทางพบลูกค้าเชียงใหม่',
    requester: 'วิภา สุขใจ',
    avatar: avatarUrl('photo-1494790108377-be9c29b29330'),
    initial: 'ว',
    type: 'เบิกเงิน',
    status: 'อนุมัติแล้ว',
    amount: '฿8,340',
    sla: 'เสร็จสิ้น',
  },
  {
    id: 'EV-26-0077',
    subject: 'จัดบูธงาน Health Expo 2026',
    requester: 'ธนา รุ่งเรือง',
    avatar: avatarUrl('photo-1500648767791-00dcc994a43e'),
    initial: 'ธ',
    type: 'อีเว้นท์',
    status: 'กำลังดำเนินการ',
    amount: '฿145,000',
    sla: 'อีก 5 วัน',
  },
  {
    id: 'PO-26-0123',
    subject: 'จัดซื้อโน้ตบุ๊กฝ่ายขาย 5 เครื่อง',
    requester: 'มานี มีทรัพย์',
    avatar: avatarUrl('photo-1534528741775-53994a69daeb'),
    initial: 'ม',
    type: 'จัดซื้อ',
    status: 'รออนุมัติ',
    amount: '฿189,500',
    sla: 'เกิน 1 วัน',
    slaOverdue: true,
  },
  {
    id: 'OT-26-0456',
    subject: 'OT ปิดงบสิ้นเดือน ทีมบัญชี',
    requester: 'สมหญิง รักงาน',
    avatar: avatarUrl('photo-1438761681033-6461ffad8d80'),
    initial: 'ส',
    type: 'OT',
    status: 'อนุมัติแล้ว',
    amount: '฿24,800',
    sla: 'เสร็จสิ้น',
  },
  {
    id: 'LV-26-0289',
    subject: 'ลาพักร้อน 3 วัน',
    requester: 'ประวิทย์ คงมั่น',
    avatar: avatarUrl('photo-1507003211169-0a1dd7228f2d'),
    initial: 'ป',
    type: 'ใบลา',
    status: 'ตีกลับ',
    amount: '—',
    sla: '—',
  },
]

const statusClass: Record<RequestStatus, string> = {
  อนุมัติแล้ว:
    'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent',
  รออนุมัติ: 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent',
  ตีกลับ: 'bg-red-100 text-red-700 hover:bg-red-100 border-transparent',
  กำลังดำเนินการ:
    'bg-blue-100 text-blue-700 hover:bg-blue-100 border-transparent',
}

// ---------- chart shared styles ----------

const tickStyle = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' }

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
}

// ---------- component ----------

export function Dashboard() {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">แดชบอร์ด</h1>
          <p className="text-sm text-muted-foreground">
            ภาพรวมคำขอและการอนุมัติ · กรกฎาคม 2569
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            ส่งออกรายงาน
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            สร้างคำขอ
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={cn('font-medium', stat.deltaClass)}>
                  {stat.delta}
                </span>
                {stat.suffix ?? ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">แนวโน้มคำขอ 6 เดือน</CardTitle>
            <CardDescription>
              เปรียบเทียบจำนวนคำขอที่ส่งและได้รับอนุมัติ
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={trendData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E08A3F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E08A3F" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={tickStyle}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={tickStyle}
                  width={36}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  name="ส่งคำขอ"
                  stroke="#E08A3F"
                  strokeWidth={2}
                  fill="url(#fillSubmitted)"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="อนุมัติ"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#fillApproved)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">คำขอตามประเภท</CardTitle>
            <CardDescription>จำนวนคำขอเดือนนี้แยกตามประเภท</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={typeData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={tickStyle}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={tickStyle}
                  width={64}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                />
                <Bar
                  dataKey="count"
                  name="จำนวนคำขอ"
                  fill="#E08A3F"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-base">คำขอล่าสุด</CardTitle>
            <CardDescription>10 รายการล่าสุดที่ส่งเข้าระบบ</CardDescription>
          </div>
          <Button variant="ghost" size="sm">
            ดูทั้งหมด
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>เรื่อง</TableHead>
                <TableHead>ผู้ขอ</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">มูลค่า</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.id}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate font-medium">
                    {row.subject}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={row.avatar} alt={row.requester} />
                        <AvatarFallback className="text-[10px]">
                          {row.initial}
                        </AvatarFallback>
                      </Avatar>
                      <span className="whitespace-nowrap">{row.requester}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('whitespace-nowrap', statusClass[row.status])}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amount}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap text-xs',
                      row.slaOverdue ? 'text-red-600' : 'text-muted-foreground'
                    )}
                  >
                    {row.sla}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard

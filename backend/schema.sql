-- mechanic-app / backend / schema.sql
-- AutoVille • 112 S Market St Ste 1008 Inglewood CA 90301 PST • BAR 142 • Zero commission $40/$100/$300

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Admin users (Super Admin)
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  role VARCHAR(50) DEFAULT 'Super Admin',
  bar_info VARCHAR(120) DEFAULT 'BAR 142 • Inglewood CA 90301',
  address TEXT DEFAULT '112 S Market St Ste 1008 Inglewood CA 90301',
  last_login TIMESTAMP,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Vehicle Owners (Car Owners)
CREATE TABLE IF NOT EXISTS vehicle_owners (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  address TEXT DEFAULT 'Inglewood CA 90301',
  city VARCHAR(80) DEFAULT 'Inglewood',
  state VARCHAR(20) DEFAULT 'CA',
  zip VARCHAR(10) DEFAULT '90301',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- 3. Workshops
CREATE TABLE IF NOT EXISTS workshops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(120),
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  bar_license VARCHAR(50) UNIQUE,
  address TEXT,
  city VARCHAR(80) DEFAULT 'Inglewood',
  state VARCHAR(20) DEFAULT 'CA',
  zip VARCHAR(10) DEFAULT '90301',
  logo_url TEXT,
  rating NUMERIC(3,2) DEFAULT 0.0,
  total_reviews INT DEFAULT 0,
  specializations TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  is_bar_verified BOOLEAN DEFAULT FALSE,
  subscription_status VARCHAR(20) DEFAULT 'Trial' CHECK (subscription_status IN ('Active','Expired','Trial','Pending Renewal','Cancelled')),
  subscription_plan VARCHAR(20) DEFAULT 'Trial' CHECK (subscription_plan IN ('Monthly','Quarterly','Annual','Trial')),
  subscription_start DATE,
  subscription_end DATE,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Cars
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES vehicle_owners(id) ON DELETE CASCADE,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INT,
  vin VARCHAR(50) UNIQUE,
  license_plate VARCHAR(20),
  color VARCHAR(30),
  mileage INT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Bookings / Appointments
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES vehicle_owners(id) ON DELETE CASCADE,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  car_id INT REFERENCES cars(id) ON DELETE SET NULL,
  service_type VARCHAR(100),
  description TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME,
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Confirmed','In Progress','Completed','Cancelled')),
  location TEXT DEFAULT '112 S Market St Inglewood CA 90301',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Jobs & Tracking
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  owner_id INT REFERENCES vehicle_owners(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'Diagnostics' CHECK (status IN ('Diagnostics','In Progress','Awaiting Parts','Ready','Delivered')),
  progress INT DEFAULT 0 CHECK (progress >=0 AND progress <=100),
  estimated_completion TIMESTAMP,
  actual_completion TIMESTAMP,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Workshop Team
CREATE TABLE IF NOT EXISTS workshop_team (
  id SERIAL PRIMARY KEY,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(80),
  email VARCHAR(120),
  phone VARCHAR(20),
  avatar_url TEXT,
  specialization VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Workshop Incomes (service payments - workshop dashboard)
CREATE TABLE IF NOT EXISTS workshop_incomes (
  id SERIAL PRIMARY KEY,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
  category VARCHAR(80) DEFAULT 'Service',
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'Cash',
  receipt_id VARCHAR(50) UNIQUE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Workshop Expenditures (audit locked, no delete)
CREATE TABLE IF NOT EXISTS workshop_expenditures (
  id SERIAL PRIMARY KEY,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  category VARCHAR(80) NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  vendor VARCHAR(120),
  receipt_id VARCHAR(50) UNIQUE NOT NULL,
  method VARCHAR(50),
  date DATE DEFAULT CURRENT_DATE,
  approved_by VARCHAR(120),
  is_audit_locked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Subscriptions (workshop subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('Monthly','Quarterly','Annual','Trial')),
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active','Expired','Trial','Pending Renewal','Cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_left INT,
  auto_renew BOOLEAN DEFAULT TRUE,
  last_payment_date DATE,
  next_billing_date DATE,
  receipt_id VARCHAR(50),
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. Admin Incomes (subscription receipts only, zero commission)
CREATE TABLE IF NOT EXISTS admin_incomes (
  id SERIAL PRIMARY KEY,
  workshop_id INT REFERENCES workshops(id) ON DELETE SET NULL,
  subscription_id INT REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan VARCHAR(20),
  amount NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(80),
  receipt_id VARCHAR(50) UNIQUE NOT NULL,
  transaction_id VARCHAR(80) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'Paid' CHECK (status IN ('Paid','Pending','Free')),
  period VARCHAR(50),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 12. Admin Expenditures (platform)
CREATE TABLE IF NOT EXISTS admin_expenditures (
  id SERIAL PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  vendor VARCHAR(120),
  receipt_id VARCHAR(50) UNIQUE NOT NULL,
  method VARCHAR(50),
  date DATE DEFAULT CURRENT_DATE,
  approved_by VARCHAR(120),
  workshop_id INT REFERENCES workshops(id) ON DELETE SET NULL,
  is_audit_locked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. Subscription Receipts (auto-generated)
CREATE TABLE IF NOT EXISTS subscription_receipts (
  id SERIAL PRIMARY KEY,
  subscription_id INT REFERENCES subscriptions(id) ON DELETE CASCADE,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_id VARCHAR(80) UNIQUE NOT NULL,
  plan VARCHAR(20),
  amount NUMERIC(10,2),
  payment_method VARCHAR(80),
  status VARCHAR(20) DEFAULT 'Paid',
  period VARCHAR(50),
  receipt_date DATE DEFAULT CURRENT_DATE,
  next_billing_date DATE,
  is_auto_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 14. Reviews / Feedbacks / Complaints / Ratings
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES vehicle_owners(id) ON DELETE CASCADE,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
  type VARCHAR(20) DEFAULT 'Review' CHECK (type IN ('Review','Feedback','Complaint','Rating','Remark','Issue')),
  rating INT CHECK (rating >=1 AND rating <=5),
  comment TEXT,
  status VARCHAR(20) DEFAULT 'Published' CHECK (status IN ('Published','Pending','Hidden','Resolved')),
  likes INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  workshop_response TEXT,
  job_ref VARCHAR(50),
  invoice_ref VARCHAR(50),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES vehicle_owners(id) ON DELETE CASCADE,
  workshop_id INT REFERENCES workshops(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(owner_id, workshop_id)
);

-- 16. Invoices (owner invoices)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES vehicle_owners(id) ON DELETE CASCADE,
  workshop_id INT REFERENCES workshops(id) ON DELETE SET NULL,
  booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Paid' CHECK (status IN ('Paid','Pending','Overdue')),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 17. Activity Logs (vital: login/logout time & date, IP, device, immutable)
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  actor VARCHAR(120) NOT NULL,
  actor_role VARCHAR(20) DEFAULT 'System' CHECK (actor_role IN ('Admin','Workshop','Owner','System')),
  activity_type VARCHAR(50) NOT NULL,
  workshop_id INT REFERENCES workshops(id) ON DELETE SET NULL,
  owner_id INT REFERENCES vehicle_owners(id) ON DELETE SET NULL,
  description TEXT,
  ip_address VARCHAR(45),
  device VARCHAR(120),
  location VARCHAR(150) DEFAULT '112 S Market St Inglewood CA 90301 PST',
  status VARCHAR(20) DEFAULT 'Success',
  session_id VARCHAR(50),
  timestamp TIMESTAMP DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

-- Indexes for performance + lazy-load filters
CREATE INDEX IF NOT EXISTS idx_bookings_workshop_date ON bookings(workshop_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_owner ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_admin_incomes_workshop_date ON admin_incomes(workshop_id, date);
CREATE INDEX IF NOT EXISTS idx_admin_exp_workshop_date ON admin_expenditures(workshop_id, date);
CREATE INDEX IF NOT EXISTS idx_reviews_workshop_type ON reviews(workshop_id, type);
CREATE INDEX IF NOT EXISTS idx_logs_type_date ON activity_logs(activity_type, date);
CREATE INDEX IF NOT EXISTS idx_subs_status_plan ON subscriptions(status, plan);
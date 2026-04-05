-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 18, 2026 at 01:33 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET @NAMES utf8mb4 */;

--
-- Database: `esa_db`
--

CREATE DATABASE IF NOT EXISTS `esa_db`;

USE `esa_db`;

-- --------------------------------------------------------
-- Trusted Schools (website partner badges)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `trusted_schools` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `logo_url` varchar(1000) DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Contact Requests (from website)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `contact_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(100) DEFAULT NULL,
  `school_name` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `admin_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;




-- --------------------------------------------------------
-- Attendance Reports (daily auto-generated summaries)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `attendance_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `school_id` int(11) NOT NULL,
  `report_date` date NOT NULL,
  `total_teachers` int(11) DEFAULT 0,
  `present_count` int(11) DEFAULT 0,
  `late_count` int(11) DEFAULT 0,
  `absent_count` int(11) DEFAULT 0,
  `present_names` text DEFAULT NULL,
  `late_names` text DEFAULT NULL,
  `absent_names` text DEFAULT NULL,
  `generated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_school_date` (`school_id`, `report_date`),
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
-- CRITICAL FIX: Added UNIQUE constraint on (teacher_id, date) to prevent duplicate records
--

CREATE TABLE `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `teacher_id` int(11) NOT NULL,
  `school_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `check_in` timestamp NULL DEFAULT NULL,
  `check_out` timestamp NULL DEFAULT NULL,
  `status` enum('present','late','absent','on_leave') DEFAULT 'absent',
  `gps_valid` tinyint(1) DEFAULT 0,
  `wifi_valid` tinyint(1) DEFAULT 0,
  `check_in_lat` decimal(10,8) DEFAULT NULL,
  `check_in_lng` decimal(11,8) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_teacher_date` (`teacher_id`, `date`),
  KEY `idx_school_date` (`school_id`, `date`),
  KEY `idx_teacher_date` (`teacher_id`, `date`),
  FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance`
--

INSERT INTO `attendance` (`id`, `teacher_id`, `school_id`, `date`, `check_in`, `check_out`, `status`, `gps_valid`, `wifi_valid`, `notes`, `created_at`) VALUES
(1, 1, 1, '2026-03-18', '2026-03-18 03:45:42', '2026-03-18 03:46:28', 'present', 1, 0, NULL, '2026-03-18 03:45:42');

-- --------------------------------------------------------

--
-- Table structure for table `logs`
--

CREATE TABLE `logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `action` varchar(255) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(60) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_timestamp` (`user_id`, `timestamp`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `logs`
--

INSERT INTO `logs` (`id`, `action`, `user_id`, `details`, `ip_address`, `timestamp`) VALUES
(1, 'CREATE_SCHOOL', 1, 'Created school: College', '::1', '2026-03-18 03:38:55'),
(2, 'LOGIN', 2, 'school_admin logged in', '::1', '2026-03-18 03:39:28'),
(3, 'UPDATE_SETTINGS', 2, 'Updated school settings', '::1', '2026-03-18 03:40:48'),
(4, 'CREATE_TEACHER', 2, 'Added teacher: Kernel', '::1', '2026-03-18 03:44:49'),
(5, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 03:45:15'),
(6, 'CHECK_IN', 3, 'Checked in - status: present', '::1', '2026-03-18 03:45:42'),
(7, 'CHECK_OUT', 3, 'Checked out', '::1', '2026-03-18 03:46:28'),
(8, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 03:50:52'),
(9, 'UPDATE_SCHOOL', 1, 'Updated school #1', '::1', '2026-03-18 05:25:28'),
(10, 'LOGIN', 2, 'school_admin logged in', '::1', '2026-03-18 05:25:53'),
(11, 'UPDATE_SETTINGS', 2, 'Updated school settings', '::1', '2026-03-18 05:26:44'),
(12, 'UPDATE_SETTINGS', 2, 'Updated school settings', '::1', '2026-03-18 05:27:03'),
(13, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 05:27:46'),
(14, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 03:31:02'),
(15, 'LOGIN', 2, 'school_admin logged in', '::1', '2026-03-18 06:01:26'),
(16, 'UPDATE_SETTINGS', 2, 'Updated school settings', '::1', '2026-03-18 06:01:59'),
(17, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 06:03:12'),
(18, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 06:03:19'),
(19, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 06:03:45'),
(20, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 06:06:36'),
(21, 'LOGIN', 2, 'school_admin logged in', '::1', '2026-03-18 06:11:53'),
(22, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 06:14:34'),
(23, 'LOGIN', 2, 'school_admin logged in', '::1', '2026-03-18 08:10:24'),
(24, 'UPDATE_SETTINGS', 2, 'Updated school attendance settings', '::1', '2026-03-18 08:11:51'),
(25, 'UPDATE_SETTINGS', 2, 'Updated school attendance settings', '::1', '2026-03-18 08:12:24'),
(26, 'UPDATE_SETTINGS', 2, 'Updated school attendance settings', '::1', '2026-03-18 08:12:32'),
(27, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 08:12:46'),
(28, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 08:13:51'),
(29, 'CREATE_SCHOOL', 1, 'Created school: ITER', '::1', '2026-03-18 08:20:41'),
(30, 'LOGIN', 4, 'school_admin logged in', '::1', '2026-03-18 08:20:58'),
(31, 'UPDATE_SETTINGS', 4, 'Updated school attendance settings', '::1', '2026-03-18 08:22:04'),
(32, 'UPDATE_SETTINGS', 4, 'Updated school attendance settings', '::1', '2026-03-18 08:24:28'),
(33, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 08:26:51'),
(34, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 09:04:21'),
(35, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 09:06:00'),
(36, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 09:17:57'),
(37, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 09:32:42'),
(38, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 09:40:40'),
(39, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 12:14:50'),
(40, 'LOGIN', 2, 'school_admin logged in', '::1', '2026-03-18 12:19:32'),
(41, 'UPDATE_SETTINGS', 2, 'Updated school attendance settings', '::1', '2026-03-18 12:20:32'),
(42, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 12:21:07'),
(43, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 12:28:40'),
(44, 'LOGIN', 1, 'super_admin logged in', '::1', '2026-03-18 12:29:15'),
(45, 'LOGIN', 2, 'school_admin logged in', '::1', '2026-03-18 12:29:56'),
(46, 'LOGIN', 3, 'teacher logged in', '::1', '2026-03-18 12:30:33');

-- --------------------------------------------------------

--
-- Table structure for table `schools`
--

CREATE TABLE `schools` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `schools`
--

INSERT INTO `schools` (`id`, `name`, `address`, `phone`, `email`, `status`, `created_at`, `updated_at`) VALUES
(1, 'College De Bethel', NULL, NULL, NULL, 'active', '2026-03-18 03:38:54', '2026-03-18 05:25:28'),
(2, 'ITER', NULL, NULL, NULL, 'active', '2026-03-18 08:20:40', '2026-03-18 08:20:40');

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `school_id` int(11) NOT NULL UNIQUE,
  `school_lat` decimal(10,8) DEFAULT 0.00000000,
  `school_lng` decimal(11,8) DEFAULT 0.00000000,
  `radius` int(11) DEFAULT 200,
  `wifi_bssid` text DEFAULT NULL,
  `gps_enabled` tinyint(1) DEFAULT 1,
  `wifi_enabled` tinyint(1) DEFAULT 0,
  `late_threshold` time DEFAULT '08:00:00',
  `absent_threshold` time DEFAULT '09:00:00',
  `work_start` time DEFAULT '07:30:00',
  `work_end` time DEFAULT '17:00:00',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `checkin_start` time DEFAULT '06:00:00',
  `checkout_time` time DEFAULT '17:00:00',
  `auto_checkout_enabled` tinyint(1) DEFAULT 1,
  `notify_admin_checkout` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `school_id`, `school_lat`, `school_lng`, `radius`, `wifi_bssid`, `gps_enabled`, `wifi_enabled`, `late_threshold`, `absent_threshold`, `work_start`, `work_end`, `created_at`, `updated_at`, `checkin_start`, `checkout_time`, `auto_checkout_enabled`, `notify_admin_checkout`) VALUES
(1, 1, -2.23869500, 29.79341500, 720, NULL, 1, 1, '08:00:00', '09:00:00', '07:30:00', '17:00:00', '2026-03-18 03:40:48', '2026-03-18 12:20:32', '06:00:00', '17:00:00', 1, 1),
(2, 2, 0.00000000, 0.00000000, 450, NULL, 1, 0, '09:00:00', '17:00:00', '07:30:00', '17:00:00', '2026-03-18 08:22:04', '2026-03-18 08:24:28', '06:00:00', '17:00:00', 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `teachers`
--

CREATE TABLE `teachers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL UNIQUE,
  `school_id` int(11) NOT NULL,
  `employee_id` varchar(100) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `position` varchar(255) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `teachers`
--

INSERT INTO `teachers` (`id`, `user_id`, `school_id`, `phone`, `subject`, `created_at`) VALUES
(1, 3, 1, NULL, NULL, '2026-03-18 03:44:49');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `role` enum('super_admin','school_admin','teacher') NOT NULL,
  `school_id` int(11) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `avatar` varchar(500) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_school_id` (`school_id`),
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `school_id`, `status`, `created_at`) VALUES
(1, 'Super Administrator', 'superadmin@esa.com', '$2b$12$abcdefghijklmnopqrstuvwxyz', 'super_admin', NULL, 'active', '2026-03-18 03:38:54'),
(2, 'School Admin', 'admin@college.com', '$2b$12$abcdefghijklmnopqrstuvwxyz', 'school_admin', 1, 'active', '2026-03-18 03:39:28'),
(3, 'Kernel', 'kernel@college.com', '$2b$12$abcdefghijklmnopqrstuvwxyz', 'teacher', 1, 'active', '2026-03-18 03:44:49');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_teacher_date` (`teacher_id`, `date`);

--
-- Indexes for table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_timestamp` (`user_id`, `timestamp`);

--
-- Indexes for table `schools`
--
ALTER TABLE `schools`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_school_id` (`school_id`);

--
-- Indexes for table `teachers`
--
ALTER TABLE `teachers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_id` (`user_id`),
  ADD KEY `idx_school_id` (`school_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_email` (`email`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_school_id` (`school_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance`
--
ALTER TABLE `attendance` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47;

--
-- AUTO_INCREMENT for table `schools`
--
ALTER TABLE `schools` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `teachers`
--
ALTER TABLE `teachers` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

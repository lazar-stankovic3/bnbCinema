Tables-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.4.32-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             12.6.0.6765
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for auth_db
DROP DATABASE IF EXISTS `auth_db`;
CREATE DATABASE IF NOT EXISTS `auth_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `auth_db`;

-- Dumping structure for table auth_db.reservations
DROP TABLE IF EXISTS `reservations`;
CREATE TABLE IF NOT EXISTS `reservations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `film_title` varchar(255) NOT NULL,
  `broj_karata` int(11) NOT NULL,
  `datum` date NOT NULL,
  `termin` varchar(10) NOT NULL DEFAULT '20:00',
  `sedista` varchar(100) DEFAULT NULL,
  `kod` varchar(40) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `email` (`email`),
  CONSTRAINT `reservations_ibfk_1` FOREIGN KEY (`email`) REFERENCES `users` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table auth_db.reservations: ~0 rows (approximately)
DELETE FROM `reservations`;

-- Dumping structure for table auth_db.reviews
DROP TABLE IF EXISTS `reviews`;
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `filmId` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `rating` int(11) NOT NULL,
  `comment` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table auth_db.reviews: ~0 rows (approximately)
DELETE FROM `reviews`;

-- Dumping structure for table auth_db.users
DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `reservation_seats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `film_title` varchar(255) NOT NULL,
  `datum` date NOT NULL,
  `termin` varchar(10) NOT NULL,
  `sediste` varchar(5) NOT NULL,
  `reservation_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_show_seat` (`film_title`,`datum`,`termin`,`sediste`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `cinema_halls` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `naziv` varchar(80) NOT NULL,
  `redovi` int(11) NOT NULL DEFAULT 5,
  `sedista_po_redu` int(11) NOT NULL DEFAULT 8,
  `aktivna` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`), UNIQUE KEY `naziv` (`naziv`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `cinema_halls` (`id`, `naziv`, `redovi`, `sedista_po_redu`) VALUES (1, 'Sala 1', 5, 8);

CREATE TABLE IF NOT EXISTS `screenings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `film_title` varchar(255) NOT NULL,
  `hall_id` int(11) NOT NULL,
  `datum` date NOT NULL,
  `termin` varchar(10) NOT NULL,
  `cena` decimal(10,2) NOT NULL DEFAULT 6.50,
  PRIMARY KEY (`id`), UNIQUE KEY `unique_screening` (`film_title`,`hall_id`,`datum`,`termin`),
  CONSTRAINT `screenings_hall_fk` FOREIGN KEY (`hall_id`) REFERENCES `cinema_halls` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dumping data for table auth_db.users: ~0 rows (approximately)
DELETE FROM `users`;

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;

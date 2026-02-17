FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite \
    && a2enmod rewrite headers \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY apache.conf /etc/apache2/sites-available/000-default.conf

EXPOSE 80

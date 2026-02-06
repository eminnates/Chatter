FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
# Tüm .csproj dosyalarını katmanlarına göre kopyala
COPY ["src/Chatter.API/Chatter.API.csproj", "src/Chatter.API/"]
COPY ["src/Chatter.Application/Chatter.Application.csproj", "src/Chatter.Application/"]
COPY ["src/Chatter.Infrastructure/Chatter.Infrastructure.csproj", "src/Chatter.Infrastructure/"]
COPY ["src/Chatter.Domain/Chatter.Domain.csproj", "src/Chatter.Domain/"]
RUN dotnet restore "src/Chatter.API/Chatter.API.csproj"

# Kalan her şeyi kopyala ve build al
COPY . .
WORKDIR "/src/src/Chatter.API"
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
# Statik dosyalar için wwwroot klasörü oluştur
RUN mkdir -p wwwroot/uploads

# Production environment
ENV ASPNETCORE_ENVIRONMENT=Production

# Render'ın PORT değişkenini runtime'da kullan (build sırasında $PORT boş olur)
# ENTRYPOINT ile shell form kullanarak runtime'da çözümlenmesini sağla
ENTRYPOINT ["sh", "-c", "dotnet Chatter.API.dll --urls http://0.0.0.0:${PORT:-10000}"]